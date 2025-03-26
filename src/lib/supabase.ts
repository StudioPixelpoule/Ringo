import { createClient } from '@supabase/supabase-js';
import { config } from './config';
import { handleError } from './errorHandler';
import { AuthErrorType } from './errorTypes';
import { adminUtils } from './adminUtils';

// Create singleton instance
let supabaseInstance: ReturnType<typeof createClient>;
let authInitialized = false;
let authCheckPromise: Promise<void> | null = null;

// Create Supabase client with retries and better error handling
function createSupabaseClient() {
  if (supabaseInstance) return supabaseInstance;

  supabaseInstance = createClient(config.supabase.url, config.supabase.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      storageKey: 'sb-auth-token',
      flowType: 'pkce',
      retryAttempts: 3,
      retryInterval: 2000
    },
    global: {
      headers: {
        'x-application-name': 'ringo',
        'x-client-info': `ringo/${config.app.version}`
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

  return supabaseInstance;
}

// Export singleton instance and admin utils
export const supabase = createSupabaseClient();
export { adminUtils };

// Initialize auth state
export async function initializeAuth() {
  console.debug('🔐 Initializing auth...');
  
  // Return existing promise if auth check is in progress
  if (authCheckPromise) {
    console.debug('🔄 Auth check already in progress, returning existing promise');
    return authCheckPromise;
  }

  // Return immediately if already initialized
  if (authInitialized) {
    console.debug('✅ Auth already initialized');
    return;
  }

  authCheckPromise = (async () => {
    try {
      console.debug('🔍 Checking session...');
      
      // First try to get session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.debug('❌ Session error:', sessionError);
        
        // Try to refresh if token expired
        if (sessionError.message.includes('JWT expired')) {
          console.debug('🔄 Token expired, attempting refresh...');
          try {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              console.warn("Failed to refresh session:", refreshError);
              return; // Don't throw error, just return
            }
            if (!refreshData.session) {
              console.warn("Session refresh did not return a session");
              return; // Don't throw error, just return
            }
            console.debug('✅ Session refreshed successfully');
          } catch (e) {
            console.warn("Error during refresh:", e);
            return; // Don't throw error
          }
        } else {
          console.warn("Session error but not JWT expired:", sessionError);
          return; // Don't throw error
        }
      }

      // If we have a session, validate it
      if (session) {
        console.debug('🔍 Validating session...');
        
        // Verify user exists
        try {
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          if (userError) {
            console.warn("User error:", userError);
            return; // Don't throw error
          }
          if (!user) {
            console.warn("User not found");
            return; // Don't throw error
          }

          console.debug('👤 User found:', user.email);

          // Check profile status
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('status, role')
            .eq('id', user.id)
            .single();

          if (profileError) {
            console.debug('❌ Profile error:', profileError);
            return; // Don't throw error
          }
          
          if (!profile?.status) {
            console.debug('❌ Profile inactive');
            return; // Don't throw error
          }

          console.debug('✅ Profile validated:', { status: profile.status, role: profile.role });

          // Store role in localStorage for quick access
          localStorage.setItem('userRole', profile.role);
          authInitialized = true;
        } catch (e) {
          console.warn("Error during user/profile validation:", e);
          return; // Don't throw error  
        }
      } else {
        console.debug('⚠️ No session found');
      }

      console.debug('✅ Auth initialization complete');
    } catch (error) {
      console.error('❌ Auth initialization error:', error);
      // Don't automatically clear localStorage
      authInitialized = false;
      throw error;
    } finally {
      authCheckPromise = null;
    }
  })();

  return authCheckPromise;
}

// Add session refresh on focus with network check
let refreshTimeout: NodeJS.Timeout;
window.addEventListener('focus', () => {
  clearTimeout(refreshTimeout);
  refreshTimeout = setTimeout(async () => {
    try {
      // Skip token check if device is offline
      if (!navigator.onLine) {
        console.debug('🌐 Device offline, skipping token check');
        return;
      }

      // Check connection quality if available
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') {
          console.debug('🌐 Poor network connection, delaying token check');
          return;
        }
      }

      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        // Check if it's a network error
        if (error.message?.includes('network') || !navigator.onLine) {
          console.warn('Network issue during token refresh, will retry on next focus');
          return;
        }
        throw error;
      }

      if (!session) {
        throw new Error('No valid session');
      }
    } catch (error) {
      await handleError(error, {
        component: 'supabase',
        action: 'refreshSession',
        isOnline: navigator.onLine,
        connectionType: ('connection' in navigator) ? (navigator as any).connection?.effectiveType : 'unknown'
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
        action: 'unhandledAuthError',
        type: AuthErrorType.SESSION_EXPIRED
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