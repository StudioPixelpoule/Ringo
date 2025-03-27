import { createChunkedStream, validateAudioChunk } from './streamUtils';
import { supabase } from './supabase';

interface ProcessingProgress {
  stage: 'upload' | 'processing' | 'extraction' | 'complete';
  progress: number;
  message: string;
  canCancel?: boolean;
}

interface AudioProcessingResult {
  content: string;
  metadata: {
    title?: string;
    duration: number;
    language?: string;
    fileType: string;
    fileName: string;
    segments: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  };
  confidence: number;
  processingDate: string;
}

function detectLanguage(text: string): string {
  const frenchPattern = /^(le|la|les|un|une|des|je|tu|il|elle|nous|vous|ils|elles|et|ou|mais|donc)\s/i;
  return frenchPattern.test(text) ? 'fra' : 'eng';
}

async function processAudioChunk(chunk: Blob, apiKey: string, signal?: AbortSignal): Promise<{
  text: string;
  segments: Array<{ start: number; end: number; text: string; }>;
}> {
  const isValid = await validateAudioChunk(chunk);
  if (!isValid) {
    throw new Error('Invalid audio chunk detected');
  }

  const formData = new FormData();
  formData.append('file', chunk);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('language', 'fr');
  formData.append('prompt', 'Transcription en français. Respecter la ponctuation.');

  try {
    // Check if operation was cancelled
    if (signal?.aborted) {
      throw new Error('Processing cancelled');
    }

    const controller = new AbortController();
    // Link the parent signal to the fetch controller
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
      signal: controller.signal
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`Transcription failed: ${error.error || response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.text || !Array.isArray(result.segments)) {
      throw new Error('Invalid response format from Whisper API');
    }

    return {
      text: result.text,
      segments: result.segments.map((s: any) => ({
        start: Number(s.start) || 0,
        end: Number(s.end) || 0,
        text: String(s.text || '').trim()
      }))
    };
  } catch (error) {
    // Check if the error is an AbortError
    if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Processing cancelled')) {
      throw new Error('Processing cancelled');
    }
    console.error('[Audio Processing] Chunk processing error:', error);
    throw error;
  }
}

export async function processAudioFile(
  file: File,
  apiKey: string,
  onProgress?: (progress: ProcessingProgress) => void,
  signal?: AbortSignal
): Promise<AudioProcessingResult> {
  try {
    // Check if operation was cancelled
    if (signal?.aborted) {
      throw new Error('Processing cancelled');
    }

    console.log(`[Audio Processing] Starting processing: ${file.name}`);

    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    // Validate file type
    const validTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 
      'audio/x-wav', 'audio/aac', 'audio/ogg', 'audio/webm'
    ];
    if (!validTypes.includes(file.type)) {
      throw new Error(`Type de fichier audio non supporté: ${file.type}`);
    }

    if (typeof onProgress === 'function') {
      onProgress({
        stage: 'processing',
        progress: 10,
        message: 'Préparation du fichier audio...',
        canCancel: true
      });
    }

    const MAX_CHUNK_SIZE = 24 * 1024 * 1024; // 24MB to stay under Whisper's 25MB limit
    let transcription = '';
    const segments: AudioProcessingResult['metadata']['segments'] = [];
    let timeOffset = 0;
    let totalDuration = 0;

    // Process file in chunks if necessary
    if (file.size > MAX_CHUNK_SIZE) {
      const chunks = await createChunkedStream(file, MAX_CHUNK_SIZE);
      
      for (let i = 0; i < chunks.length; i++) {
        // Check if operation was cancelled
        if (signal?.aborted) {
          throw new Error('Processing cancelled');
        }

        if (typeof onProgress === 'function') {
          onProgress({
            stage: 'processing',
            progress: 10 + ((i / chunks.length) * 80),
            message: `Transcription partie ${i + 1} sur ${chunks.length}`,
            canCancel: true
          });
        }

        // Pass the signal to processAudioChunk
        const result = await processAudioChunk(chunks[i], apiKey, signal);
        transcription += (transcription ? ' ' : '') + result.text;
        
        const adjustedSegments = result.segments.map(segment => ({
          start: segment.start + timeOffset,
          end: segment.end + timeOffset,
          text: segment.text
        }));
        
        segments.push(...adjustedSegments);
        
        const lastSegment = result.segments[result.segments.length - 1];
        if (lastSegment) {
          timeOffset = lastSegment.end;
          totalDuration = Math.max(totalDuration, lastSegment.end + timeOffset);
        }
      }
    } else {
      if (typeof onProgress === 'function') {
        onProgress({
          stage: 'processing',
          progress: 50,
          message: 'Transcription en cours...',
          canCancel: true
        });
      }

      // Check if operation was cancelled
      if (signal?.aborted) {
        throw new Error('Processing cancelled');
      }

      // Pass the signal to processAudioChunk
      const result = await processAudioChunk(file, apiKey, signal);
      transcription = result.text;
      segments.push(...result.segments);
      totalDuration = result.segments[result.segments.length - 1]?.end || 0;
    }

    if (typeof onProgress === 'function') {
      onProgress({
        stage: 'processing',
        progress: 90,
        message: 'Finalisation de la transcription...',
        canCancel: true
      });
    }

    // Check if operation was cancelled
    if (signal?.aborted) {
      throw new Error('Processing cancelled');
    }

    // Prepare result
    const result: AudioProcessingResult = {
      content: transcription,
      metadata: {
        title: file.name.replace(/\.[^/.]+$/, ''),
        duration: totalDuration,
        language: detectLanguage(transcription),
        fileType: file.type,
        fileName: file.name,
        segments
      },
      confidence: 0.95,
      processingDate: new Date().toISOString()
    };

    if (typeof onProgress === 'function') {
      onProgress({
        stage: 'complete',
        progress: 100,
        message: 'Transcription terminée',
        canCancel: false
      });
    }

    console.log('[Audio Processing] Processing completed successfully');
    return result;
  } catch (error) {
    // Properly handle AbortError
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message === 'Processing cancelled') {
        console.log('[Audio Processing] Processing cancelled by user');
        throw new Error('Traitement annulé');
      }
      console.error('[Audio Processing] Error:', error);
      throw new Error(`Échec de la transcription: ${error.message}`);
    }
    console.error('[Audio Processing] Unexpected error:', error);
    throw new Error('Une erreur inattendue est survenue lors de la transcription');
  }
}