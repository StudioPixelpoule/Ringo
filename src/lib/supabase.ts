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
    detectSessionInUrl: true,
    flowType: 'pkce'
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

export async function uploadFile(
  bucket: string,
  path: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    // Upload file
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

    // Get public URL
    const { data: urlData, error: urlError } = await supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    if (urlError) throw urlError;
    if (!urlData?.publicUrl) throw new Error('Failed to get public URL');

    // Verify file is accessible
    const response = await fetch(urlData.publicUrl, { method: 'HEAD' });
    if (!response.ok) {
      throw new Error(`File verification failed: ${response.statusText}`);
    }

    // Verify file size
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) !== file.size) {
      throw new Error(`File size mismatch: expected ${file.size}, got ${contentLength}`);
    }

    return urlData.publicUrl;
  } catch (error) {
    // Clean up failed upload
    if (path) {
      await supabase.storage
        .from(bucket)
        .remove([path])
        .catch(console.error);
    }

    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function deleteFile(bucket: string, path: string): Promise<void> {
  try {
    // Verify file exists before deletion
    const { data: existingFile, error: existError } = await supabase.storage
      .from(bucket)
      .download(path);

    if (existError || !existingFile) {
      throw new Error('File not found');
    }

    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) throw error;

    // Verify deletion
    const { data: verifyData } = await supabase.storage
      .from(bucket)
      .download(path);

    if (verifyData) {
      throw new Error('File deletion verification failed: File still exists');
    }
  } catch (error) {
    throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to get file URL
export async function getFileUrl(bucket: string, path: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600); // 1 hour expiry

    return data?.signedUrl || null;
  } catch (error) {
    console.error('Failed to get file URL:', error);
    return null;
  }
}

// Helper function to check if file exists
export async function fileExists(bucket: string, path: string): Promise<boolean> {
  try {
    const { data } = await supabase.storage
      .from(bucket)
      .download(path);

    return !!data;
  } catch {
    return false;
  }
}