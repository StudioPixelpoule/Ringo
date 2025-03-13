import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Function to clean up auth state
export const recoverAuth = async (redirectToLogin = true) => {
  try {
    console.log('Recovering authentication state...');
    
    // Clear all auth-related storage
    const keysToRemove = [
      'sb-kitzhhrhlaevrtbqnbma-auth-token',
      'ringo_auth',
      'supabase.auth.token',
      'supabase-auth-token'
    ];
    
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch (e) {
        console.warn(`Failed to remove ${key} from storage`, e);
      }
    });
    
    // Sign out with global scope
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (e) {
      console.warn('Sign out failed, continuing with recovery', e);
    }
    
    // Force refresh auth state
    try {
      await supabase.auth.refreshSession();
      await supabase.auth.getSession();
    } catch (e) {
      console.warn('Session refresh failed, continuing with recovery', e);
    }
    
    // Redirect if needed
    if (redirectToLogin && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    
    console.log('Authentication state recovered');
  } catch (e) {
    console.error('Recovery failed:', e);
    if (redirectToLogin && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
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
    debug: import.meta.env.DEV,
    // Add retry options
    retryAttempts: 3,
    retryInterval: 2000
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
  }
});

// Enhanced error handler for auth issues
const handleAuthError = async (error: any) => {
  if (
    error?.message?.includes('refresh_token_not_found') ||
    error?.message?.includes('Invalid Refresh Token') ||
    error?.message?.includes('JWT expired') ||
    error?.message?.includes('Invalid JWT') ||
    error?.status === 400 ||
    error?.code === 'PGRST301'
  ) {
    console.warn('Authentication error detected, recovering session...', error);
    await recoverAuth();
    return true;
  }
  return false;
};

// Safe query wrapper
export const safeQuery = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (await handleAuthError(error)) {
      throw new Error('Authentication error, please login again');
    }
    throw error;
  }
};

// Initialize auth state
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event);
  
  if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
    recoverAuth();
  } else if (event === 'TOKEN_REFRESHED') {
    console.log('Token refreshed successfully');
  }
});

// Initial session check
supabase.auth.getSession().catch(error => {
  console.warn('Session check failed:', error);
  handleAuthError(error);
});

// Global error handler
window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason?.name === 'AuthApiError' || 
    event.reason?.code === 'PGRST301' ||
    (event.reason?.error && event.reason.error.status === 400)
  ) {
    handleAuthError(event.reason);
  }
});