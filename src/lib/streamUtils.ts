import { logError } from './errorLogger';
import { getChunkSize } from './constants';

interface ChunkingOptions {
  maxChunkSize?: number;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

export async function createChunkedStream(
  file: File, 
  options: ChunkingOptions = {}
): Promise<Blob[]> {
  const {
    maxChunkSize = getChunkSize(file.type),
    onProgress,
    signal
  } = options;

  const chunks: Blob[] = [];
  let offset = 0;
  const totalChunks = Math.ceil(file.size / maxChunkSize);

  try {
    while (offset < file.size) {
      // Check for cancellation
      if (signal?.aborted) {
        throw new Error('Operation cancelled');
      }

      const chunk = file.slice(offset, offset + maxChunkSize);
      
      if (chunk.size === 0) break;
      
      const buffer = await chunk.arrayBuffer();
      if (buffer.byteLength === 0) break;
      
      chunks.push(new Blob([buffer], { type: file.type }));
      offset += maxChunkSize;

      // Report progress
      if (onProgress) {
        onProgress((offset / file.size) * 100);
      }

      // Release chunk data
      buffer.slice(0);

      // Allow UI to update
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    return chunks;
  } catch (error) {
    logError(error, {
      component: 'streamUtils',
      action: 'createChunkedStream',
      fileType: file.type,
      fileSize: file.size,
      chunkSize: maxChunkSize
    });
    throw error;
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
    logError(error, {
      component: 'streamUtils',
      action: 'validateAudioChunk',
      chunkSize: chunk.size,
      mimeType: chunk.type
    });
    return false;
  }
}

export async function* createStreamFromFile(
  file: File,
  options: ChunkingOptions = {}
): AsyncGenerator<Blob, void, unknown> {
  const {
    maxChunkSize = getChunkSize(file.type),
    onProgress,
    signal
  } = options;

  let offset = 0;

  try {
    while (offset < file.size) {
      if (signal?.aborted) {
        throw new Error('Operation cancelled');
      }

      const chunk = file.slice(offset, offset + maxChunkSize);
      if (chunk.size === 0) break;

      yield chunk;
      offset += chunk.size;

      if (onProgress) {
        onProgress((offset / file.size) * 100);
      }

      await new Promise(resolve => setTimeout(resolve, 0));
    }
  } catch (error) {
    logError(error, {
      component: 'streamUtils',
      action: 'createStreamFromFile',
      fileType: file.type,
      fileSize: file.size,
      chunkSize: maxChunkSize
    });
    throw error;
  }
}

export async function concatenateBlobs(blobs: Blob[]): Promise<Blob> {
  try {
    const buffers = await Promise.all(
      blobs.map(blob => blob.arrayBuffer())
    );
    return new Blob(buffers, { type: blobs[0]?.type });
  } catch (error) {
    logError(error, {
      component: 'streamUtils',
      action: 'concatenateBlobs',
      blobCount: blobs.length,
      totalSize: blobs.reduce((sum, blob) => sum + blob.size, 0)
    });
    throw error;
  }
}