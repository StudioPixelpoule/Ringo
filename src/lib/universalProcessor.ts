import { ProcessingProgress, ProcessingOptions, ProcessingResult } from './types';

export async function processDocument(
  file: File,
  options?: ProcessingOptions
): Promise<ProcessingResult> {
  try {
    // Validate file size
    const validation = validateFileSize(file);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    options?.onProgress?.({
      stage: 'preparation',
      progress: 10,
      message: 'Préparation du fichier...'
    });

    // Process in chunks if file is large
    if (file.size > 5 * 1024 * 1024) { // 5MB threshold
      return await processLargeFile(file, options);
    }

    // Handle audio files separately
    if (file.type.startsWith('audio/')) {
      if (!options?.openaiApiKey) {
        throw new Error('OpenAI API key required for audio processing');
      }
      return await processAudioFile(file, options?.onProgress, options?.signal);
    }

    // Process other document types
    return await processDocumentBase(file, options);
  } catch (error) {
    logError(error, {
      component: 'universalProcessor',
      action: 'processDocument',
      fileType: file.type,
      fileSize: file.size
    });
    throw error;
  }
}

async function processLargeFile(
  file: File,
  options?: ProcessingOptions
): Promise<string> {
  const chunks: string[] = [];
  let processedSize = 0;

  try {
    for await (const chunk of createStreamFromFile(file, {
      maxChunkSize: 5 * 1024 * 1024, // 5MB chunks
      onProgress: (progress) => {
        options?.onProgress?.({
          stage: 'processing',
          progress: progress * 0.8, // Reserve 20% for final processing
          message: `Traitement du fichier : ${Math.round(progress)}%`
        });
      },
      signal: options?.signal
    })) {
      // Process each chunk
      const chunkResult = await processDocumentBase(
        new File([chunk], file.name, { type: file.type }),
        {
          ...options,
          onProgress: undefined // Disable progress for chunks
        }
      );

      chunks.push(chunkResult);
      processedSize += chunk.size;

      // Allow UI to update
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Combine results
    options?.onProgress?.({
      stage: 'extraction',
      progress: 90,
      message: 'Finalisation du traitement...'
    });

    const result = chunks.join('\n');

    options?.onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Traitement terminé'
    });

    return result;
  } catch (error) {
    logError(error, {
      component: 'universalProcessor',
      action: 'processLargeFile',
      fileType: file.type,
      fileSize: file.size,
      processedSize
    });
    throw error;
  }
}