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
    audioDescription?: string;
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

async function convertToWav(audioBlob: Blob): Promise<Blob> {
  // Create an audio context
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // Convert blob to array buffer
  const arrayBuffer = await audioBlob.arrayBuffer();
  
  // Decode the audio data
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Create an offline context for rendering
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );
  
  // Create a buffer source
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start();
  
  // Render the audio
  const renderedBuffer = await offlineContext.startRendering();
  
  // Convert to WAV format
  const wavData = convertToWavFormat(renderedBuffer);
  
  // Create a new blob with WAV format
  return new Blob([wavData], { type: 'audio/wav' });
}

function convertToWavFormat(audioBuffer: AudioBuffer): ArrayBuffer {
  const numOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numOfChannels * 2;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);
  
  // Write WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numOfChannels, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * numOfChannels * 2, true);
  view.setUint16(32, numOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, length, true);
  
  // Write audio data
  const channels = [];
  for (let i = 0; i < numOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }
  
  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Maximum size for OpenAI API (24MB)
const MAX_CHUNK_SIZE = 24 * 1024 * 1024;
const MAX_RETRIES = 5;
const RETRY_DELAY_BASE = 2000; // 2 seconds base delay

async function processAudioChunk(chunk: Blob, apiKey: string, signal?: AbortSignal): Promise<{
  text: string;
  segments: Array<{ start: number; end: number; text: string; }>;
}> {
  const isValid = await validateAudioChunk(chunk);
  if (!isValid) {
    throw new Error('Invalid audio chunk detected');
  }

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('OpenAI API key is missing or invalid');
  }

  // Convert to WAV if needed
  let processedChunk = chunk;
  if (chunk.type !== 'audio/wav' && chunk.type !== 'audio/wave' && chunk.type !== 'audio/x-wav') {
    try {
      processedChunk = await convertToWav(chunk);
    } catch (error) {
      console.error('Error converting audio format:', error);
      throw new Error('Failed to convert audio to WAV format. Please try a different audio file.');
    }
  }

  // Check chunk size after conversion
  if (processedChunk.size > MAX_CHUNK_SIZE) {
    throw new Error(`Audio chunk size (${processedChunk.size} bytes) exceeds maximum allowed size (${MAX_CHUNK_SIZE} bytes)`);
  }

  const formData = new FormData();
  formData.append('file', processedChunk);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('language', 'fr');
  formData.append('prompt', 'Transcription en français. Respecter la ponctuation.');

  try {
    if (signal?.aborted) {
      throw new Error('Processing cancelled');
    }

    const controller = new AbortController();
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < MAX_RETRIES) {
      try {
        const isConnected = await checkNetworkConnectivity();
        if (!isConnected) {
          console.warn(`Network connectivity issue detected (attempt ${attempt + 1})`);
          const networkRetryDelay = RETRY_DELAY_BASE * Math.pow(2, attempt) * 1.5;
          await new Promise(resolve => setTimeout(resolve, networkRetryDelay));
          attempt++;
          continue;
        }

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          body: formData,
          signal: controller.signal,
          timeout: 60000 * 2 // 2 minute timeout
        });

        if (!response.ok) {
          let errorDetails = '';
          try {
            const errorData = await response.json();
            errorDetails = JSON.stringify(errorData);
          } catch (e) {
            errorDetails = response.statusText;
          }

          if (response.status === 413) {
            throw new Error('Audio chunk too large for OpenAI API');
          }

          throw new Error(`Transcription failed (HTTP ${response.status}): ${errorDetails}`);
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
        if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Processing cancelled')) {
          throw new Error('Processing cancelled');
        }

        if (error instanceof Error && error.message === 'Audio chunk too large for OpenAI API') {
          throw error;
        }

        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        if (attempt >= MAX_RETRIES) {
          console.error(`[Audio Processing] All ${MAX_RETRIES} attempts failed:`, lastError);
          throw lastError;
        }

        const delay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
        console.warn(`[Audio Processing] Attempt ${attempt} failed, retrying in ${delay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Unexpected error in retry logic');
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Processing cancelled')) {
      throw new Error('Processing cancelled');
    }
    console.error('[Audio Processing] Chunk processing error:', error);
    throw error;
  }
}

async function checkNetworkConnectivity(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).limit(1);
    return !error;
  } catch (error) {
    console.warn('Network connectivity check failed:', error);
    return false;
  }
}

async function splitAudioIntoChunks(file: File): Promise<Blob[]> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const chunks: Blob[] = [];
  const samplesPerChunk = Math.floor((MAX_CHUNK_SIZE / (audioBuffer.numberOfChannels * 2)) * 0.9); // 90% of max size to be safe
  const totalSamples = audioBuffer.length;
  
  for (let offset = 0; offset < totalSamples; offset += samplesPerChunk) {
    const chunkLength = Math.min(samplesPerChunk, totalSamples - offset);
    const chunkBuffer = new AudioBuffer({
      numberOfChannels: audioBuffer.numberOfChannels,
      length: chunkLength,
      sampleRate: audioBuffer.sampleRate
    });
    
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      const chunkData = channelData.slice(offset, offset + chunkLength);
      chunkBuffer.copyToChannel(chunkData, channel, 0);
    }
    
    const wavData = convertToWavFormat(chunkBuffer);
    chunks.push(new Blob([wavData], { type: 'audio/wav' }));
  }
  
  return chunks;
}

export async function processAudioFile(
  file: File,
  apiKey: string,
  audioDescription?: string,
  onProgress?: (progress: ProcessingProgress) => void,
  signal?: AbortSignal
): Promise<AudioProcessingResult> {
  try {
    if (signal?.aborted) {
      throw new Error('Processing cancelled');
    }

    console.log(`[Audio Processing] Starting processing: ${file.name}`);

    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const validTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 
      'audio/x-wav', 'audio/aac', 'audio/ogg', 'audio/webm',
      'audio/mp4', 'audio/mpga', 'audio/m4a', 'audio/flac'
    ];
    
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const isValidExtension = ['mp3', 'wav', 'wave', 'aac', 'ogg', 'webm', 'm4a', 'mp4', 'mpga', 'flac'].includes(fileExtension || '');
    
    if (!validTypes.includes(file.type) && !file.type.startsWith('audio/') && !isValidExtension) {
      throw new Error(`Type de fichier audio non supporté: ${file.type || fileExtension}. Formats supportés: MP3, WAV, AAC, OGG, WEBM, M4A, FLAC.`);
    }

    const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB max file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`La taille du fichier (${(file.size / (1024 * 1024)).toFixed(2)}MB) dépasse la limite maximale autorisée (500MB)`);
    }

    if (typeof onProgress === 'function') {
      onProgress({
        stage: 'processing',
        progress: 10,
        message: 'Préparation du fichier audio...',
        canCancel: true
      });
    }

    let audioChunks: Blob[];
    if (file.size > MAX_CHUNK_SIZE) {
      if (typeof onProgress === 'function') {
        onProgress({
          stage: 'processing',
          progress: 20,
          message: 'Découpage du fichier audio en segments...',
          canCancel: true
        });
      }
      audioChunks = await splitAudioIntoChunks(file);
    } else {
      audioChunks = [file];
    }

    let transcription = '';
    const segments: AudioProcessingResult['metadata']['segments'] = [];
    let timeOffset = 0;
    let totalDuration = 0;

    const totalChunks = audioChunks.length;
    console.log(`[Audio Processing] File will be processed in ${totalChunks} chunks`);

    for (let i = 0; i < totalChunks; i++) {
      if (signal?.aborted) {
        throw new Error('Processing cancelled');
      }

      const chunkProgress = (i / totalChunks) * 80;
      if (typeof onProgress === 'function') {
        onProgress({
          stage: 'processing',
          progress: 20 + chunkProgress,
          message: `Transcription partie ${i + 1} sur ${totalChunks}`,
          canCancel: true
        });
      }

      let retryCount = 0;
      let chunkResult;
      
      while (retryCount < 3) {
        try {
          chunkResult = await processAudioChunk(audioChunks[i], apiKey, signal);
          break;
        } catch (error) {
          if (error instanceof Error && 
             (error.message.includes('network') || 
              error.message.includes('internet') ||
              error.message.includes('Failed to fetch'))) {
            
            retryCount++;
            if (retryCount >= 3) throw error;
            
            const delay = 5000 * Math.pow(2, retryCount);
            if (typeof onProgress === 'function') {
              onProgress({
                stage: 'processing',
                progress: 20 + chunkProgress,
                message: `Problème réseau détecté. Nouvelle tentative dans ${Math.round(delay/1000)} secondes...`,
                canCancel: true
              });
            }
            
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw error;
          }
        }
      }
      
      if (!chunkResult) {
        throw new Error('Échec de la transcription après plusieurs tentatives');
      }

      transcription += (transcription ? ' ' : '') + chunkResult.text;
      
      const adjustedSegments = chunkResult.segments.map(segment => ({
        start: segment.start + timeOffset,
        end: segment.end + timeOffset,
        text: segment.text
      }));
      
      segments.push(...adjustedSegments);
      
      const lastSegment = chunkResult.segments[chunkResult.segments.length - 1];
      if (lastSegment) {
        timeOffset += lastSegment.end;
        totalDuration = Math.max(totalDuration, lastSegment.end + timeOffset);
      }
    }

    if (typeof onProgress === 'function') {
      onProgress({
        stage: 'processing',
        progress: 90,
        message: 'Finalisation de la transcription...',
        canCancel: true
      });
    }

    if (signal?.aborted) {
      throw new Error('Processing cancelled');
    }

    let enhancedContent = transcription;
    if (audioDescription && audioDescription.trim()) {
      enhancedContent = `== CONTEXTE DE L'ENREGISTREMENT ==\n${audioDescription.trim()}\n\n== TRANSCRIPTION ==\n${transcription}`;
    }

    const result: AudioProcessingResult = {
      content: enhancedContent,
      metadata: {
        title: file.name.replace(/\.[^/.]+$/, ''),
        duration: totalDuration,
        language: detectLanguage(transcription),
        fileType: file.type || `audio/${fileExtension}`,
        fileName: file.name,
        audioDescription: audioDescription?.trim(),
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