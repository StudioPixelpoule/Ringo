export async function createChunkedStream(file: File, chunkSize: number): Promise<Blob[]> {
  const chunks: Blob[] = [];
  let offset = 0;

  try {
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize);
      
      if (chunk.size === 0) break;
      
      const buffer = await chunk.arrayBuffer();
      if (buffer.byteLength === 0) break;
      
      chunks.push(new Blob([buffer], { type: file.type }));
      offset += chunkSize;
      
      // Release chunk data
      buffer.slice(0);
    }
    
    return chunks;
  } catch (error) {
    console.error('[Stream Utils] Error creating chunks:', error);
    throw new Error('Failed to create file chunks');
  }
}

export async function validateAudioChunk(chunk: Blob): Promise<boolean> {
  try {
    // For small chunks, just validate the MIME type
    if (chunk.size < 1024) {
      return chunk.type.startsWith('audio/');
    }
    
    // For larger chunks, try to decode the audio
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await chunk.arrayBuffer();
    
    try {
      await audioContext.decodeAudioData(arrayBuffer);
      await audioContext.close();
      return true;
    } catch (decodeError) {
      console.warn('[Stream Utils] Audio decoding failed:', decodeError);
      
      // If decoding fails, check file headers as fallback
      const header = new Uint8Array(arrayBuffer.slice(0, Math.min(12, arrayBuffer.byteLength)));
      
      // Check for common audio file headers
      // MP3: ID3 (49 44 33) or MPEG frame sync (FF Fx)
      // WAV: RIFF header (52 49 46 46)
      // AAC: ADIF header (41 44 49 46) or ADTS frame sync (FF Fx)
      // OGG: OggS (4F 67 67 53)
      
      const isMP3 = (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) || 
                    (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0);
      const isWAV = header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46;
      const isAAC = (header[0] === 0x41 && header[1] === 0x44 && header[2] === 0x49 && header[3] === 0x46) ||
                    (header[0] === 0xFF && (header[1] & 0xF0) === 0xF0);
      const isOGG = header[0] === 0x4F && header[1] === 0x67 && header[2] === 0x67 && header[3] === 0x53;
      
      await audioContext.close();
      return isMP3 || isWAV || isAAC || isOGG;
    }
  } catch (error) {
    console.warn('[Stream Utils] Audio validation error:', error);
    
    // If all validation fails, trust the MIME type as last resort
    return chunk.type.startsWith('audio/');
  }
}