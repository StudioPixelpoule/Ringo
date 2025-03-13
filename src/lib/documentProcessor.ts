import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import mammoth from 'mammoth';
import { processAudioFile } from './audioProcessor';

// Initialize PDF.js worker
const workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface ProcessingProgress {
  stage: 'preparation' | 'processing' | 'extraction' | 'complete';
  progress: number;
  message: string;
}

interface ProcessingOptions {
  onProgress?: (progress: ProcessingProgress) => void;
  signal?: AbortSignal;
}

export async function processDocument(
  file: File,
  options?: ProcessingOptions
): Promise<string> {
  try {
    console.log('📄 Starting document processing:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Validate file size
    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      throw new Error('Le fichier est trop volumineux (limite: 100MB)');
    }

    let result: string;
    const extension = file.name.split('.').pop()?.toLowerCase();

    // Handle audio files
    if (file.type.startsWith('audio/')) {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key is required for audio processing');
      }
      result = await processAudioFile(file, apiKey, options?.onProgress);
    }
    // Handle data files
    else if (['json', 'csv', 'xlsx', 'xls'].includes(extension || '')) {
      throw new Error('Data file processing not implemented');
    }
    // Handle documents
    else {
      switch (file.type.toLowerCase()) {
        case 'application/pdf':
          throw new Error('PDF processing not implemented');

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'text/plain':
          options?.onProgress?.({
            stage: 'processing',
            progress: 50,
            message: 'Extraction du texte...'
          });

          const arrayBuffer = await file.arrayBuffer();
          const extractResult = await mammoth.extractRawText({ arrayBuffer });
          
          if (!extractResult.value) {
            throw new Error('No text content extracted from document');
          }

          result = JSON.stringify({
            text: extractResult.value,
            metadata: {
              fileName: file.name,
              fileType: file.type,
              processingDate: new Date().toISOString()
            }
          });

          options?.onProgress?.({
            stage: 'complete',
            progress: 100,
            message: 'Extraction terminée'
          });
          break;

        default:
          throw new Error(`Type de fichier non supporté: ${file.type}`);
      }
    }

    if (!result?.trim()) {
      throw new Error(`Aucun contenu valide extrait de ${file.name}`);
    }

    console.log('✅ Document processing completed:', {
      fileName: file.name,
      contentLength: result.length
    });

    return result;
  } catch (error) {
    console.error('[Document Processing] Error:', error);
    throw error;
  }
}