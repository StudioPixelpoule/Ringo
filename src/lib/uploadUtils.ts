import SparkMD5 from 'spark-md5';
import { supabase } from './supabase';
import { logError } from './errorLogger';

const CHUNK_SIZE = 6 * 1024 * 1024; // 6MB chunks
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB max file size
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // Base delay in ms

export interface UploadProgress {
  progress: number;
  message: string;
}

export async function calculateFileHash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunkSize = 2097152; // 2MB chunks for hashing
    const chunks = Math.ceil(file.size / chunkSize);
    let currentChunk = 0;
    const spark = new SparkMD5.ArrayBuffer();
    const fileReader = new FileReader();

    fileReader.onload = (e) => {
      spark.append(e.target?.result as ArrayBuffer);
      currentChunk++;

      if (currentChunk < chunks) {
        loadNext();
      } else {
        resolve(spark.end());
      }
    };

    fileReader.onerror = () => {
      reject(new Error('Failed to calculate file hash'));
    };

    function loadNext() {
      const start = currentChunk * chunkSize;
      const end = start + chunkSize >= file.size ? file.size : start + chunkSize;
      fileReader.readAsArrayBuffer(file.slice(start, end));
    }

    loadNext();
  });
}

async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  retries: number = MAX_RETRIES,
  baseDelay: number = RETRY_DELAY,
  context: string = ''
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Log retry attempt
      console.warn(`Retry ${i + 1}/${retries} failed for ${context}:`, error);
      
      if (i < retries - 1) {
        const delay = baseDelay * Math.pow(2, i); // Exponential backoff
        await wait(delay);
      }
    }
  }

  // Log final failure
  console.error(`All ${retries} retries failed for ${context}:`, lastError);
  throw lastError;
}

export async function uploadFileInChunks(
  file: File,
  filePath: string,
  onProgress?: (progress: UploadProgress) => void,
  signal?: AbortSignal
): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }

  try {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let uploadedChunks = 0;

    // Calculate file hash for deduplication
    onProgress?.({ progress: 0, message: 'Calcul de l\'empreinte du fichier...' });
    const fileHash = await calculateFileHash(file);

    // Check if file already exists in cache
    const { data: existingFile, error: cacheError } = await retryWithBackoff(
      () => supabase
        .from('document_cache')
        .select('hash')
        .eq('hash', fileHash)
        .limit(1)
        .maybeSingle(),
      3,
      1000,
      'cache check'
    );

    if (cacheError) {
      console.warn('Cache check failed:', cacheError);
    } else if (existingFile) {
      onProgress?.({ progress: 100, message: 'Fichier déjà traité, utilisation du cache...' });
      return filePath;
    }

    // Upload file in chunks
    for (let i = 0; i < totalChunks; i++) {
      if (signal?.aborted) {
        throw new Error('Upload cancelled');
      }

      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      await retryWithBackoff(
        async () => {
          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(`${filePath}_part_${i}`, chunk, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;
        },
        3,
        1000,
        `chunk upload ${i + 1}/${totalChunks}`
      );

      uploadedChunks++;
      const progress = Math.round((uploadedChunks / totalChunks) * 100);
      onProgress?.({ 
        progress, 
        message: `Téléversement du fichier... ${progress}%` 
      });
    }

    // Combine chunks
    onProgress?.({ progress: 95, message: 'Finalisation du téléversement...' });
    
    const { error: combineError } = await retryWithBackoff(
      () => supabase.functions.invoke('combine-chunks', {
        body: { 
          filePath,
          totalChunks,
          fileHash,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        }
      }),
      3,
      1000,
      'combine chunks'
    );

    if (combineError) {
      // Log detailed error information
      logError(combineError, {
        context: 'combine-chunks',
        file: {
          name: file.name,
          type: file.type,
          size: file.size
        },
        chunks: totalChunks
      });
      throw combineError;
    }

    // Cleanup temporary chunks
    for (let i = 0; i < totalChunks; i++) {
      await supabase.storage
        .from('documents')
        .remove([`${filePath}_part_${i}`])
        .catch(error => {
          console.warn(`Failed to cleanup chunk ${i}:`, error);
        });
    }

    onProgress?.({ progress: 100, message: 'Téléversement terminé' });
    return filePath;
  } catch (error) {
    // Log detailed error information
    logError(error instanceof Error ? error : new Error(String(error)), {
      context: 'uploadFileInChunks',
      file: {
        name: file.name,
        type: file.type,
        size: file.size
      }
    });
    
    console.error('Error in uploadFileInChunks:', error);
    throw error;
  }
}