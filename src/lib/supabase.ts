import { createClient } from '@supabase/supabase-js';
import { config } from './config';
import { handleError } from './errorHandler';
import { AuthErrorType } from './errorTypes';

// Singleton instance
let supabaseInstance: ReturnType<typeof createClient>;

// Create Supabase client with retries and better error handling
function createSupabaseClient() {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  supabaseInstance = createClient(config.supabase.url, config.supabase.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      storageKey: 'sb-auth-token',
      flowType: 'pkce'
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

// Create admin client with service role key
function createAdminClient() {
  return createClient(config.supabase.url, config.supabase.serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storage: undefined // Prevent storage for admin client
    }
  });
}

// Export singleton instances
export const supabase = createSupabaseClient();
const supabaseAdmin = createAdminClient();

// Admin utilities
export const adminUtils = {
  async createUser(email: string, password: string, role: string) {
    try {
      // Create user with admin client
      const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase(),
        password: password,
        email_confirm: true,
        user_metadata: { role }
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Error creating user account');

      return { user: authData.user };
    } catch (error) {
      await handleError(error, {
        component: 'adminUtils',
        action: 'createUser',
        email
      });
      throw error;
    }
  },

  async deleteUser(userId: string) {
    try {
      // Call edge function to delete user
      const response = await fetch(`${config.supabase.url}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.supabase.anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
      }

      return { success: true };
    } catch (error) {
      await handleError(error, {
        component: 'adminUtils',
        action: 'deleteUser',
        userId
      });
      throw error;
    }
  }
};

// Initialize auth state
let authInitialized = false;
let authCheckPromise: Promise<void> | null = null;

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
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) throw refreshError;
          if (!refreshData.session) throw new Error('Session refresh failed');
          console.debug('✅ Session refreshed successfully');
        } else {
          throw sessionError;
        }
      }

      // If we have a session, validate it
      if (session) {
        console.debug('🔍 Validating session...');
        
        // Verify user exists
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error('User not found');

        console.debug('👤 User found:', user.email);

        // Check profile status
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('status, role')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.debug('❌ Profile error:', profileError);
          throw profileError;
        }
        
        if (!profile?.status) {
          console.debug('❌ Profile inactive');
          throw new Error('Profile inactive');
        }

        console.debug('✅ Profile validated:', { status: profile.status, role: profile.role });

        // Store role in localStorage for quick access
        localStorage.setItem('userRole', profile.role);
      } else {
        console.debug('⚠️ No session found');
      }

      console.debug('✅ Auth initialization complete');
      authInitialized = true;
    } catch (error) {
      console.error('❌ Auth initialization error:', error);
      
      // Clear auth state on critical errors
      await supabase.auth.signOut();
      localStorage.clear();
      authInitialized = false;

      await handleError(error, {
        component: 'supabase',
        action: 'initializeAuth'
      });

      throw error;
    } finally {
      authCheckPromise = null;
    }
  })();

  return authCheckPromise;
}

// Set up auth state change listener
supabase.auth.onAuthStateChange(async (event, session) => {
  console.debug('🔄 Auth state change:', event);
  
  try {
    if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
      console.debug('👋 User signed out or deleted');
      localStorage.clear();
      authInitialized = false;
      window.location.href = '/login';
    } else if (event === 'SIGNED_IN') {
      console.debug('🎉 User signed in, initializing auth...');
      await initializeAuth();
    } else if (event === 'TOKEN_REFRESHED') {
      console.debug('🔄 Token refreshed');
      authInitialized = true;
    }
  } catch (error) {
    console.error('❌ Auth state change error:', error);
    
    await handleError(error, {
      component: 'supabase',
      action: 'authStateChange',
      event
    });
    
    localStorage.clear();
    authInitialized = false;
    window.location.href = '/login';
  }
});

// Add session refresh on focus
let refreshTimeout: NodeJS.Timeout;
window.addEventListener('focus', () => {
  clearTimeout(refreshTimeout);
  refreshTimeout = setTimeout(async () => {
    try {
      console.debug('🔍 Checking session on focus...');
      
      if (!authInitialized) {
        console.debug('🔄 Auth not initialized, initializing...');
        await initializeAuth();
        return;
      }

      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      if (!session) {
        console.debug('⚠️ No session found on focus');
        localStorage.clear();
        authInitialized = false;
        window.location.href = '/login';
        return;
      }

      // Try to refresh session
      console.debug('🔄 Refreshing session...');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw refreshError;
      if (!refreshData.session) throw new Error('Session refresh failed');
      
      console.debug('✅ Session refreshed successfully');
    } catch (error) {
      console.error('❌ Session refresh error:', error);
      
      await handleError(error, {
        component: 'supabase',
        action: 'refreshSession'
      });
      
      localStorage.clear();
      authInitialized = false;
      window.location.href = '/login';
    }
  }, 1000);
});

// Add unhandled rejection listener for auth errors
window.addEventListener('unhandledrejection', async (event) => {
  try {
    if (event.reason?.name === 'AuthApiError' || 
        event.reason?.message?.includes('JWT expired') ||
        event.reason?.message?.includes('Invalid JWT')) {
      console.error('❌ Unhandled auth error:', event.reason);
      
      await handleError(event.reason, {
        component: 'supabase',
        action: 'unhandledAuthError',
        type: AuthErrorType.SESSION_EXPIRED
      });
      
      localStorage.clear();
      authInitialized = false;
      window.location.href = '/login';
    }
  } catch (error) {
    console.error('❌ Critical error in unhandled rejection handler:', error);
    localStorage.clear();
    authInitialized = false;
    window.location.href = '/login';
  }
});

export default supabase;