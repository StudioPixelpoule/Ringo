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
      // Check and refresh token if necessary before each attempt
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.href = '/login';
        throw new Error('Session expired');
      }

      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (
        lastError.message.includes('Invalid Refresh Token') || 
        lastError.message.includes('JWT expired') ||
        lastError.message.includes('refresh_token_not_found')
      ) {
        console.log('Auth error detected, forcing token refresh...');
        try {
          await supabase.auth.refreshSession();
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          throw lastError;
        }
      }
      
      console.warn(`Retry ${i + 1}/${retries} failed for ${context}:`, error);
      
      if (i < retries - 1) {
        await wait(baseDelay * Math.pow(2, i));
      }
    }
  }

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

    // Pour les fichiers volumineux, utiliser une approche par manifeste
    if (file.size > 50 * 1024 * 1024) { // Plus de 50MB
      console.log(`Large file detected (${(file.size/1024/1024).toFixed(2)}MB), using manifest approach`);
      
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      let uploadedChunks = 0;

      // Upload all chunks
      for (let i = 0; i < totalChunks; i++) {
        if (signal?.aborted) {
          throw new Error('Upload cancelled');
        }

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const chunkPath = `${filePath}_chunk_${i}`;

        await retryWithBackoff(
          async () => {
            const { error: uploadError } = await supabase.storage
              .from('documents')
              .upload(chunkPath, chunk, {
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
        const progress = Math.round((uploadedChunks / totalChunks) * 90);
        onProgress?.({ 
          progress, 
          message: `Téléversement du fichier... ${progress}%` 
        });
      }

      // Create manifest file
      const manifest = {
        originalFile: file.name,
        fileHash,
        fileType: file.type,
        fileSize: file.size,
        createdAt: new Date().toISOString(),
        totalChunks,
        chunkSize: CHUNK_SIZE,
        chunks: Array.from({ length: totalChunks }, (_, i) => ({
          index: i,
          path: `${filePath}_chunk_${i}`,
          start: i * CHUNK_SIZE,
          end: Math.min((i + 1) * CHUNK_SIZE, file.size)
        }))
      };

      // Convert manifest to string for storage
      const manifestContent = JSON.stringify(manifest, null, 2);

      // Upload manifest
      onProgress?.({ progress: 95, message: 'Création du manifeste...' });
      const manifestPath = `${filePath}_manifest.json`;
      const manifestBlob = new Blob([manifestContent], { 
        type: 'application/json' 
      });

      const { error: manifestError } = await supabase.storage
        .from('documents')
        .upload(manifestPath, manifestBlob, {
          cacheControl: '3600',
          upsert: true
        });

      if (manifestError) throw manifestError;

      // Update cache with manifest content
      const { error: cachingError } = await supabase
        .from('document_cache')
        .upsert([{
          hash: fileHash,
          content: manifestContent,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          cached_at: new Date().toISOString(),
          is_chunked: true,
          manifest_path: manifestPath
        }]);

      if (cachingError) throw cachingError;

      onProgress?.({ progress: 100, message: 'Téléversement terminé' });
      return manifestPath;
    } else {
      // Pour les fichiers plus petits, upload direct
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get file content for cache
      let content = '';
      if (file.type.startsWith('text/') || file.type === 'application/json') {
        content = await file.text();
      } else {
        content = `Binary file: ${file.name} (${file.type})`;
      }

      // Update cache for regular files
      const { error: cachingError } = await supabase
        .from('document_cache')
        .upsert([{
          hash: fileHash,
          content,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          cached_at: new Date().toISOString(),
          is_chunked: false
        }]);

      if (cachingError) throw cachingError;

      onProgress?.({ progress: 100, message: 'Téléversement terminé' });
      return filePath;
    }
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