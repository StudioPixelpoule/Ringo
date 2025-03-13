import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Fonction pour nettoyer l'état d'authentification
export const recoverAuth = async () => {
  try {
    // Déconnexion explicite
    await supabase.auth.signOut();
    
    // Nettoyage du stockage local
    localStorage.removeItem('sb-kitzhhrhlaevrtbqnbma-auth-token');
    localStorage.removeItem('ringo_auth');
    localStorage.removeItem('supabase.auth.token');
    
    // Redirection vers la page de connexion
    window.location.href = '/login';
  } catch (e) {
    console.error('Recovery error:', e);
    window.location.href = '/login';
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: window.localStorage,
    storageKey: 'ringo_auth',
    debug: import.meta.env.DEV
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-application-name': 'ringo'
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  storage: {
    retryCount: 3,
    retryInterval: 1000
  }
});

// Initialize auth state
supabase.auth.getSession().catch(error => {
  console.error('Failed to get initial session:', error);
  if (error.message?.includes('refresh_token_not_found')) {
    recoverAuth();
  }
});

// Set up auth state change listener
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event);
  
  if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
    recoverAuth();
  } else if (event === 'TOKEN_REFRESHED') {
    console.log('Token refreshed successfully');
  } else if (event === 'SIGNED_IN') {
    console.log('User signed in successfully');
  }
});

// Handle auth errors
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.name === 'AuthApiError') {
    console.error('Auth error:', event.reason);
    if (
      event.reason.message?.includes('refresh_token_not_found') ||
      event.reason.message?.includes('Invalid Refresh Token') ||
      event.reason.message?.includes('JWT expired') ||
      event.reason.message?.includes('Invalid JWT')
    ) {
      recoverAuth();
    }
  }
});

// Helper function to check if response is an auth error
function isAuthError(error: any): boolean {
  return (
    error?.message?.includes('JWT expired') ||
    error?.message?.includes('Invalid JWT') ||
    error?.message?.includes('refresh_token_not_found') ||
    error?.code === 'PGRST301' ||
    error?.code === '401'
  );
}

// Helper function to handle auth errors
async function handleAuthError(error: any): Promise<void> {
  console.error('Auth error:', error);
  if (isAuthError(error)) {
    await recoverAuth();
  }
}

export async function validateSession(): Promise<boolean> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return !!session;
  } catch (error) {
    console.error('Session validation failed:', error);
    if (isAuthError(error)) {
      await handleAuthError(error);
    }
    return false;
  }
}

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

    if (error) {
      if (isAuthError(error)) {
        await handleAuthError(error);
      }
      throw error;
    }
    
    if (!data?.path) throw new Error('Upload failed: No path returned');

    // Get public URL
    const { data: urlData, error: urlError } = await supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    if (urlError) {
      if (isAuthError(urlError)) {
        await handleAuthError(urlError);
      }
      throw urlError;
    }
    
    if (!urlData?.publicUrl) throw new Error('Failed to get public URL');

    return urlData.publicUrl;
  } catch (error) {
    console.error('Upload error:', error);
    if (isAuthError(error)) {
      await handleAuthError(error);
    }
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}