import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-application-name': 'ringo'
    }
  },
  storage: {
    retryCount: 3,
    retryInterval: 1000
  }
});

// Add error handling for storage operations
export async function uploadFile(
  bucket: string,
  path: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        onUploadProgress: ({ loaded, total }) => {
          const progress = (loaded / total) * 100;
          onProgress?.(progress);
        },
      });

    if (error) throw error;
    if (!data?.path) throw new Error('Upload failed: No path returned');

    return data.path;
  } catch (error) {
    console.error('[Storage] Upload error:', error);
    throw new Error('Failed to upload file');
  }
}

export async function deleteFile(bucket: string, path: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) throw error;
  } catch (error) {
    console.error('[Storage] Delete error:', error);
    throw new Error('Failed to delete file');
  }
}