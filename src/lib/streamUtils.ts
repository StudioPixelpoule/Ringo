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
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await chunk.arrayBuffer();
    await audioContext.decodeAudioData(arrayBuffer);
    await audioContext.close();
    return true;
  } catch (error) {
    console.warn('[Stream Utils] Invalid audio chunk:', error);
    return false;
  }
}