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

// Configuration optimisée pour la transcription
const AUDIO_CONFIG = {
  SAMPLE_RATE: 16000, // 16kHz suffit pour la voix
  CHANNELS: 1, // Mono pour réduire la taille
  MAX_PARALLEL_CHUNKS: 3, // Traiter 3 chunks en parallèle
  CHUNK_DURATION_SECONDS: 300, // 5 minutes par chunk
  MIN_CHUNK_SIZE: 1024 * 1024, // 1MB minimum
  COMPRESSION_QUALITY: 0.7 // Qualité de compression
};

// Fonction optimisée de compression audio
async function compressAudioForTranscription(file: File): Promise<Blob> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: AUDIO_CONFIG.SAMPLE_RATE
  });
  
  const arrayBuffer = await file.arrayBuffer();
  const originalBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Créer un buffer mono avec le sample rate optimisé
  const duration = originalBuffer.duration;
  const length = Math.ceil(duration * AUDIO_CONFIG.SAMPLE_RATE);
  
  const monoBuffer = new AudioBuffer({
    numberOfChannels: AUDIO_CONFIG.CHANNELS,
    length: length,
    sampleRate: AUDIO_CONFIG.SAMPLE_RATE
  });
  
  // Convertir en mono en moyennant les canaux
  const monoData = monoBuffer.getChannelData(0);
  
  if (originalBuffer.numberOfChannels > 1) {
    // Moyenne de tous les canaux
    for (let i = 0; i < length; i++) {
      const originalIndex = Math.floor(i * originalBuffer.sampleRate / AUDIO_CONFIG.SAMPLE_RATE);
      if (originalIndex < originalBuffer.length) {
        let sum = 0;
        for (let channel = 0; channel < originalBuffer.numberOfChannels; channel++) {
          sum += originalBuffer.getChannelData(channel)[originalIndex];
        }
        monoData[i] = sum / originalBuffer.numberOfChannels;
      }
    }
  } else {
    // Resample si nécessaire
    const ratio = originalBuffer.sampleRate / AUDIO_CONFIG.SAMPLE_RATE;
    for (let i = 0; i < length; i++) {
      const originalIndex = Math.floor(i * ratio);
      if (originalIndex < originalBuffer.length) {
        monoData[i] = originalBuffer.getChannelData(0)[originalIndex];
      }
    }
  }
  
  // Convertir en WAV optimisé
  const wavData = convertToWavFormat(monoBuffer);
  return new Blob([wavData], { type: 'audio/wav' });
}

// Découpage optimisé avec durée fixe
async function splitAudioIntoOptimizedChunks(file: File): Promise<Blob[]> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: AUDIO_CONFIG.SAMPLE_RATE
  });
  
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const chunks: Blob[] = [];
  const samplesPerChunk = AUDIO_CONFIG.SAMPLE_RATE * AUDIO_CONFIG.CHUNK_DURATION_SECONDS;
  const totalSamples = audioBuffer.length;
  const originalSampleRate = audioBuffer.sampleRate;
  
  for (let offset = 0; offset < totalSamples; offset += samplesPerChunk) {
    const originalChunkLength = Math.min(samplesPerChunk, totalSamples - offset);
    
    // Calculer la longueur après resampling
    const resampledLength = Math.ceil(originalChunkLength * AUDIO_CONFIG.SAMPLE_RATE / originalSampleRate);
    
    const chunkBuffer = new AudioBuffer({
      numberOfChannels: AUDIO_CONFIG.CHANNELS,
      length: resampledLength,
      sampleRate: AUDIO_CONFIG.SAMPLE_RATE
    });
    
    const chunkData = chunkBuffer.getChannelData(0);
    
    // Resample et convertir en mono
    const ratio = originalSampleRate / AUDIO_CONFIG.SAMPLE_RATE;
    for (let i = 0; i < resampledLength; i++) {
      const originalIndex = Math.floor(offset + i * ratio);
      if (originalIndex < audioBuffer.length) {
        let sum = 0;
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
          sum += audioBuffer.getChannelData(channel)[originalIndex];
        }
        chunkData[i] = sum / audioBuffer.numberOfChannels;
      }
    }
    
    const wavData = convertToWavFormat(chunkBuffer);
    const chunkBlob = new Blob([wavData], { type: 'audio/wav' });
    
    // Vérifier que le chunk n'est pas trop petit
    if (chunkBlob.size >= AUDIO_CONFIG.MIN_CHUNK_SIZE || chunks.length === 0) {
      chunks.push(chunkBlob);
    } else if (chunks.length > 0) {
      // Fusionner avec le chunk précédent si trop petit
      const lastChunk = chunks[chunks.length - 1];
      const combined = new Blob([lastChunk, chunkBlob], { type: 'audio/wav' });
      chunks[chunks.length - 1] = combined;
    }
  }
  
  return chunks;
}

// Traitement parallèle des chunks
async function processChunksInParallel(
  chunks: Blob[],
  apiKey: string,
  onProgress: (progress: ProcessingProgress) => void,
  signal?: AbortSignal
): Promise<{
  transcription: string;
  segments: Array<{ start: number; end: number; text: string }>;
  totalDuration: number;
}> {
  const results: Array<{ text: string; segments: any[] }> = new Array(chunks.length);
  let processedCount = 0;
  let timeOffsets: number[] = new Array(chunks.length);
  
  // Calculer les offsets temporels
  let currentOffset = 0;
  for (let i = 0; i < chunks.length; i++) {
    timeOffsets[i] = currentOffset;
    currentOffset += AUDIO_CONFIG.CHUNK_DURATION_SECONDS;
  }
  
  const processChunk = async (index: number): Promise<void> => {
    try {
      const result = await processAudioChunk(chunks[index], apiKey, signal);
      results[index] = result;
      processedCount++;
      
      onProgress({
        stage: 'processing',
        progress: Math.round(20 + (processedCount / chunks.length) * 70),
        message: `Transcription ${processedCount}/${chunks.length} parties`,
        canCancel: true
      });
    } catch (error) {
      // En cas d'erreur, réessayer une fois
      console.warn(`Erreur sur le chunk ${index}, nouvelle tentative...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      const result = await processAudioChunk(chunks[index], apiKey, signal);
      results[index] = result;
      processedCount++;
      
      onProgress({
        stage: 'processing',
        progress: Math.round(20 + (processedCount / chunks.length) * 70),
        message: `Transcription ${processedCount}/${chunks.length} parties`,
        canCancel: true
      });
    }
  };
  
  // Traiter les chunks par batch
  const batchSize = AUDIO_CONFIG.MAX_PARALLEL_CHUNKS;
  for (let i = 0; i < chunks.length; i += batchSize) {
    if (signal?.aborted) {
      throw new Error('Processing cancelled');
    }
    
    const batch: Promise<void>[] = [];
    for (let j = 0; j < batchSize && i + j < chunks.length; j++) {
      batch.push(processChunk(i + j));
    }
    
    await Promise.all(batch);
  }
  
  // Combiner les résultats
  let transcription = '';
  const allSegments: Array<{ start: number; end: number; text: string }> = [];
  let totalDuration = 0;
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    transcription += (transcription ? ' ' : '') + result.text;
    
    // Ajuster les timestamps des segments
    const adjustedSegments = result.segments.map(segment => ({
      start: segment.start + timeOffsets[i],
      end: segment.end + timeOffsets[i],
      text: segment.text
    }));
    
    allSegments.push(...adjustedSegments);
    
    if (result.segments.length > 0) {
      const lastSegment = result.segments[result.segments.length - 1];
      totalDuration = Math.max(totalDuration, lastSegment.end + timeOffsets[i]);
    }
  }
  
  return { transcription, segments: allSegments, totalDuration };
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
          signal: controller.signal
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
        message: 'Préparation et optimisation du fichier audio...',
        canCancel: true
      });
    }

    // OPTIMISATION 1: Compresser l'audio d'abord (mono + 16kHz)
    let optimizedFile: Blob;
    try {
      console.log('[Audio Processing] Compressing audio for optimal transcription...');
      optimizedFile = await compressAudioForTranscription(file);
      console.log(`[Audio Processing] Compression done. Original: ${(file.size / 1024 / 1024).toFixed(2)}MB, Optimized: ${(optimizedFile.size / 1024 / 1024).toFixed(2)}MB`);
    } catch (compressionError) {
      console.warn('[Audio Processing] Compression failed, using original file:', compressionError);
      optimizedFile = file;
    }

    // OPTIMISATION 2: Utiliser le découpage optimisé
    let audioChunks: Blob[];
    if (optimizedFile.size > MAX_CHUNK_SIZE) {
      if (typeof onProgress === 'function') {
        onProgress({
          stage: 'processing',
          progress: 20,
          message: 'Découpage optimisé du fichier audio...',
          canCancel: true
        });
      }
      audioChunks = await splitAudioIntoOptimizedChunks(file); // Utiliser le fichier original pour un découpage précis
    } else {
      audioChunks = [optimizedFile];
    }

    console.log(`[Audio Processing] File will be processed in ${audioChunks.length} chunks`);

    // OPTIMISATION 3: Traitement parallèle
    let result: { transcription: string; segments: any[]; totalDuration: number };
    
    if (audioChunks.length > 1) {
      // Utiliser le traitement parallèle pour plusieurs chunks
      result = await processChunksInParallel(
        audioChunks,
        apiKey,
        (progress) => onProgress?.(progress),
        signal
      );
    } else {
      // Traitement simple pour un seul chunk
      if (typeof onProgress === 'function') {
        onProgress({
          stage: 'processing',
          progress: 50,
          message: 'Transcription en cours...',
          canCancel: true
        });
      }
      
      const chunkResult = await processAudioChunk(audioChunks[0], apiKey, signal);
      result = {
        transcription: chunkResult.text,
        segments: chunkResult.segments,
        totalDuration: chunkResult.segments.length > 0 
          ? chunkResult.segments[chunkResult.segments.length - 1].end 
          : 0
      };
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

    let enhancedContent = result.transcription;
    if (audioDescription && audioDescription.trim()) {
      enhancedContent = `== CONTEXTE DE L'ENREGISTREMENT ==\n${audioDescription.trim()}\n\n== TRANSCRIPTION ==\n${result.transcription}`;
    }

    const finalResult: AudioProcessingResult = {
      content: enhancedContent,
      metadata: {
        title: file.name.replace(/\.[^/.]+$/, ''),
        duration: result.totalDuration,
        language: detectLanguage(result.transcription),
        fileType: file.type || `audio/${fileExtension}`,
        fileName: file.name,
        audioDescription: audioDescription?.trim(),
        segments: result.segments
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
    return finalResult;
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