import { createClient } from '@supabase/supabase-js';
import { config } from './config';
import { handleError } from './errorHandler';
import { AuthErrorType } from './errorTypes';

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
supabase.auth.getSession().catch(async error => {
  console.error('Error getting initial session:', error);
  try {
    await handleError(error, {
      component: 'supabase',
      action: 'getInitialSession'
    });
  } catch (err) {
    if (err instanceof Error && 
        (err.message.includes('JWT expired') || 
         err.message.includes('Invalid JWT'))) {
      localStorage.clear();
      window.location.href = '/login';
    }
  }
});

// Set up auth state change listener
supabase.auth.onAuthStateChange(async (event, session) => {
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
  refreshTimeout = setTimeout(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // No valid session, redirect to login
        window.location.href = '/login';
      }
    } catch (error) {
      await handleError(error, {
        component: 'supabase',
        action: 'refreshSession'
      });

      if (error instanceof Error && 
          (error.message.includes('refresh_token_not_found') || 
           error.message.includes('JWT expired') || 
           error.message.includes('Invalid JWT'))) {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
  }, 1000);
});

// Add unhandled rejection listener for auth errors
window.addEventListener('unhandledrejection', async (event) => {
  try {
    if (event.reason?.name === 'AuthApiError' || 
        event.reason?.message?.includes('JWT expired') ||
        event.reason?.message?.includes('Invalid JWT')) {
      await handleError(event.reason, {
        component: 'supabase',
        action: 'unhandledAuthError'
      });
      localStorage.clear();
      window.location.href = '/login';
    }
  } catch (error) {
    console.error('Critical error in unhandled rejection handler:', error);
    localStorage.clear();
    window.location.href = '/login';
  }
});

export default supabase;