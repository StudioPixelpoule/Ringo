import { ReadableStream } from 'web-streams-polyfill';

export async function createChunkedStream(file: File, chunkSize: number): Promise<Blob[]> {
  const chunks: Blob[] = [];
  let offset = 0;

  try {
    // Create a readable stream from the file
    const stream = file.stream();
    const reader = stream.getReader();

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize);
      
      // Ensure chunk is valid
      if (chunk.size === 0) break;
      
      // Read chunk data to verify it's valid
      const buffer = await chunk.arrayBuffer();
      if (buffer.byteLength === 0) break;
      
      chunks.push(new Blob([buffer], { type: file.type }));
      offset += chunkSize;
      
      // Release chunk data
      buffer.slice(0);
    }

    // Clean up
    reader.releaseLock();
    
    return chunks;
  } catch (error) {
    console.error('[Stream Utils] Error creating chunks:', error);
    throw new Error('Failed to create file chunks');
  }
}

export async function validateAudioChunk(chunk: Blob): Promise<boolean> {
  try {
    // Create an audio context
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Convert blob to array buffer
    const arrayBuffer = await chunk.arrayBuffer();
    
    // Try to decode the audio data
    await audioContext.decodeAudioData(arrayBuffer);
    
    // Clean up
    await audioContext.close();
    
    return true;
  } catch (error) {
    console.warn('[Stream Utils] Invalid audio chunk:', error);
    return false;
  }
}