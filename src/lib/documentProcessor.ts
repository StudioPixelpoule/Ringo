import { processAudioFile } from './audioProcessor';
import { processPDF } from './pdf';
import { processWordDocument } from './wordProcessor';
import { ProcessingResult, ProcessingProgress } from './types';

export async function processDocument(
  file: File,
  options: {
    openaiApiKey?: string;
    onProgress?: (progress: ProcessingProgress) => void;
    signal?: AbortSignal;
  } = {}
): Promise<ProcessingResult> {
  const { openaiApiKey, onProgress, signal } = options;

  try {
    // Validation du type de fichier
    const fileType = file.type.toLowerCase();
    
    // Traitement audio
    if (fileType.startsWith('audio/')) {
      if (!openaiApiKey) {
        throw new Error('Clé API OpenAI requise pour le traitement audio');
      }
      return await processAudioFile(file, openaiApiKey, onProgress, signal);
    }
    
    // Traitement PDF
    if (fileType === 'application/pdf') {
      return await processPDF(file, onProgress, signal);
    }
    
    // Traitement Word
    if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileType === 'application/msword'
    ) {
      return await processWordDocument(file, onProgress, signal);
    }

    throw new Error(`Type de fichier non supporté: ${fileType}`);
  } catch (error) {
    console.error('[Document Processor] Error:', error);
    throw error;
  }
}