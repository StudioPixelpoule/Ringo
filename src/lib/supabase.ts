import { createClient } from '@supabase/supabase-js';
import { config } from './config';

// Create Supabase client with retries and better error handling
export const supabase = createClient(config.supabase.url, config.supabase.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: window.localStorage,
    storageKey: 'sb-auth-token',
  },
  global: {
    headers: {
      'x-application-name': 'ringo'
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Create admin client with service role key
export const supabaseAdmin = createClient(config.supabase.url, config.supabase.serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Initialize auth state
supabase.auth.getSession().catch(error => {
  console.error('Error getting initial session:', error);
  if (error?.message?.includes('JWT expired') || 
      error?.message?.includes('Invalid JWT')) {
    localStorage.clear();
    window.location.href = '/login';
  }
});

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
            error?.message?.includes('Invalid JWT')) {
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

export default supabase;