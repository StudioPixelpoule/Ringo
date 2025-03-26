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
    flowType: 'pkce',
    storage: window.localStorage,
    storageKey: 'sb-auth-token'
  },
  global: {
    headers: {
      'x-application-name': 'ringo'
    }
  }
});

// Initialize auth state
supabase.auth.getSession().catch(console.error);

// Set up auth state change listener
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
    // Clear any cached data
    localStorage.clear();
    // Redirect to login
    window.location.href = '/login';
  } else if (event === 'TOKEN_REFRESHED') {
    console.log('Session token refreshed');
  }
});

// Add session refresh on focus
let refreshTimeout: NodeJS.Timeout;
window.addEventListener('focus', () => {
  clearTimeout(refreshTimeout);
  refreshTimeout = setTimeout(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!session) {
          // No valid session, redirect to login
          window.location.href = '/login';
        }
      })
      .catch((error) => {
        console.error('Session refresh error:', error);
        if (error?.message?.includes('refresh_token_not_found') || 
            error?.message?.includes('JWT expired') || 
            error?.message?.includes('Invalid Refresh Token')) {
          localStorage.clear();
          window.location.href = '/login';
        }
      });
  }, 1000);
});

// Add unhandled rejection listener for auth errors
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.name === 'AuthApiError' || 
      event.reason?.message?.includes('JWT expired') ||
      event.reason?.message?.includes('Invalid JWT')) {
    console.error('Auth API Error:', event.reason);
    localStorage.clear();
    window.location.href = '/login';
  }
});