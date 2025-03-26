import { createClient } from '@supabase/supabase-js';
import { handleError } from './errorHandler';
import { AuthErrorType } from './errorTypes';

// Get environment variables directly
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required Supabase environment variables');
}

// Create singleton instance
let supabaseInstance: ReturnType<typeof createClient>;

// Create Supabase client with retries and better error handling
function createSupabaseClient() {
  if (supabaseInstance) return supabaseInstance;

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: localStorage,
      storageKey: 'sb-auth-token',
      flowType: 'pkce'
    },
    global: {
      headers: {
        'x-application-name': 'ringo',
        'x-client-info': 'ringo/1.1.0'
      }
    }
  });

  return supabaseInstance;
}

// Export singleton instance
export const supabase = createSupabaseClient();

// Admin utilities for user management
export const adminUtils = {
  /**
   * Create a new user with the specified role
   */
  async createUser(email: string, password: string, role: string) {
    try {
      // Create user using Edge Function
      const response = await fetch('/functions/v1/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({ email, password, role })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user');
      }

      const { user } = await response.json();
      return { user };
    } catch (error) {
      throw await handleError(error, {
        component: 'adminUtils',
        action: 'createUser',
        email
      });
    }
  },

  /**
   * Delete a user and all associated data
   */
  async deleteUser(userId: string) {
    try {
      // Delete user using Edge Function
      const response = await fetch('/functions/v1/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({ user_id: userId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete user');
      }

      return true;
    } catch (error) {
      throw await handleError(error, {
        component: 'adminUtils',
        action: 'deleteUser',
        userId
      });
    }
  }
};

// Initialize auth state
let authInitialized = false;
let authCheckPromise: Promise<void> | null = null;

async function initializeAuth() {
  if (authInitialized || authCheckPromise) return;

  authCheckPromise = (async () => {
    try {
      // Check initial session
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (session) {
        // Validate session
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('status, role')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profile?.status) {
          throw new Error('Profile inactive or not found');
        }

        // Store role in localStorage
        localStorage.setItem('userRole', profile.role);
      }

      authInitialized = true;
    } catch (error) {
      await handleError(error, {
        component: 'supabase',
        action: 'initializeAuth',
        type: AuthErrorType.INITIALIZATION_FAILED
      });
      
      // Clear session on auth errors
      await supabase.auth.signOut();
      localStorage.clear();
      window.location.href = '/login';
    } finally {
      authCheckPromise = null;
    }
  })();

  await authCheckPromise;
}

// Initialize auth on load
initializeAuth().catch(console.error);

// Set up auth state change listener
supabase.auth.onAuthStateChange(async (event, session) => {
  try {
    if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
      localStorage.clear();
      window.location.href = '/login';
    } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      await initializeAuth();
    }
  } catch (error) {
    await handleError(error, {
      component: 'supabase',
      action: 'authStateChange',
      event
    });
    localStorage.clear();
    window.location.href = '/login';
  }
});

// Add session refresh on focus
let refreshTimeout: NodeJS.Timeout;
window.addEventListener('focus', () => {
  if (!navigator.onLine) return;

  clearTimeout(refreshTimeout);
  refreshTimeout = setTimeout(async () => {
    try {
      await initializeAuth();
    } catch (error) {
      await handleError(error, {
        component: 'supabase',
        action: 'refreshSession'
      });
    }
  }, 1000);
});

// Add network status listeners
window.addEventListener('online', () => {
  console.debug('🌐 Network online, refreshing auth...');
  initializeAuth().catch(console.error);
});

window.addEventListener('offline', () => {
  console.debug('🌐 Network offline');
});

export default supabase;