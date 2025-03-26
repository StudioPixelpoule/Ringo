import { createChunkedStream, validateAudioChunk } from './streamUtils';

interface ProcessingProgress {
  stage: 'upload' | 'processing' | 'complete';
  progress: number;
  message: string;
  canCancel?: boolean;
}

interface AudioProcessingResult {
  text: string;
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

async function processAudioChunk(chunk: Blob, apiKey: string): Promise<{
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

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
    console.error('[Audio Processing] Chunk processing error:', error);
    throw error;
  }
}

export async function processAudioFile(
  file: File,
  onProgress?: (progress: ProcessingProgress) => void,
  signal?: AbortSignal
): Promise<string> {
  try {
    console.log(`[Audio Processing] Starting processing: ${file.name}`);

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    // Check if operation was cancelled
    if (signal?.aborted) {
      throw new Error('Processing cancelled');
    }

    // Validate file type
    const validTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 
      'audio/x-wav', 'audio/aac', 'audio/ogg', 'audio/webm'
    ];
    if (!validTypes.includes(file.type)) {
      throw new Error(`Type de fichier audio non supporté: ${file.type}`);
    }

    // Validate file size (25MB limit for Whisper API)
    if (file.size > 25 * 1024 * 1024) {
      throw new Error('Le fichier audio ne doit pas dépasser 25MB');
    }

    onProgress?.({
      stage: 'processing',
      progress: 10,
      message: 'Préparation du fichier audio...',
      canCancel: true
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('language', 'fr');
    formData.append('prompt', 'Transcription en français. Respecter la ponctuation et la structure du texte.');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5min timeout

      onProgress?.({
        stage: 'processing',
        progress: 30,
        message: 'Transcription en cours...',
        canCancel: true
      });

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(`Échec de la transcription: ${error.error || response.statusText}`);
      }

      const result = await response.json();

      if (!result.text || !Array.isArray(result.segments)) {
        throw new Error('Format de réponse invalide de l\'API Whisper');
      }

      onProgress?.({
        stage: 'processing',
        progress: 70,
        message: 'Structuration du texte...',
        canCancel: true
      });

      // Format the transcription with proper structure
      const formattedText = {
        text: result.text,
        metadata: {
          title: file.name.replace(/\.[^/.]+$/, ''),
          duration: result.duration,
          language: detectLanguage(result.text),
          fileType: file.type,
          fileName: file.name,
          segments: result.segments.map((s: any) => ({
            start: Number(s.start) || 0,
            end: Number(s.end) || 0,
            text: String(s.text || '').trim()
          }))
        },
        confidence: result.segments.reduce((acc: number, s: any) => acc + (s.confidence || 0), 0) / result.segments.length,
        processingDate: new Date().toISOString()
      };

      onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Transcription terminée',
        canCancel: false
      });

      return JSON.stringify(formattedText);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('La transcription a pris trop de temps');
        }
        throw new Error(`Échec de la transcription: ${error.message}`);
      }
      throw new Error('Une erreur inattendue est survenue lors de la transcription');
    }
  } catch (error) {
    console.error('[Audio Processing] Error:', error);
    throw error;
  }
}