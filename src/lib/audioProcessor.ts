import { createChunkedStream, validateAudioChunk } from './streamUtils';

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
  // Validate chunk before processing
  const isValid = await validateAudioChunk(chunk);
  if (!isValid) {
    throw new Error('Invalid audio chunk detected');
  }

  const formData = new FormData();
  formData.append('file', chunk);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData
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
    console.error('[Audio Processing] Chunk processing error:', error);
    throw error;
  }
}

export async function processAudioFile(file: File): Promise<string> {
  try {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp3'];
    if (!validTypes.includes(file.type)) {
      throw new Error(`Type de fichier audio non supporté: ${file.type}`);
    }

    const MAX_CHUNK_SIZE = 24 * 1024 * 1024; // 24MB to stay under Whisper's 25MB limit
    let transcription = '';
    const segments: AudioProcessingResult['metadata']['segments'] = [];
    let timeOffset = 0;
    let totalDuration = 0;

    // Process file in chunks if necessary
    if (file.size > MAX_CHUNK_SIZE) {
      const chunks = await createChunkedStream(file, MAX_CHUNK_SIZE);
      
      for (const chunk of chunks) {
        const result = await processAudioChunk(chunk, apiKey);
        transcription += (transcription ? ' ' : '') + result.text;
        
        // Adjust segment timestamps with offset
        const adjustedSegments = result.segments.map(segment => ({
          start: segment.start + timeOffset,
          end: segment.end + timeOffset,
          text: segment.text
        }));
        
        segments.push(...adjustedSegments);
        
        // Update time offset for next chunk
        const lastSegment = result.segments[result.segments.length - 1];
        if (lastSegment) {
          timeOffset = lastSegment.end;
          totalDuration = Math.max(totalDuration, lastSegment.end + timeOffset);
        }
      }
    } else {
      // Process small file directly
      const result = await processAudioChunk(file, apiKey);
      transcription = result.text;
      segments.push(...result.segments);
      totalDuration = result.segments[result.segments.length - 1]?.end || 0;
    }

    // Prepare result
    const result: AudioProcessingResult = {
      text: transcription,
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

    return JSON.stringify(result);
  } catch (error) {
    console.error('[Audio Processing] Error:', error);
    throw new Error(`Failed to process audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}