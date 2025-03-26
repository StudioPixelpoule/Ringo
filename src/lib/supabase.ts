import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';
import { handleError } from './errorHandler';
import { AuthErrorType } from './errorTypes';

// Create singleton instance
let supabaseInstance: SupabaseClient;

// Create Supabase client with retries and better error handling
function createSupabaseClient() {
  if (supabaseInstance) return supabaseInstance;

  supabaseInstance = createClient(config.supabase.url, config.supabase.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: window.localStorage,
      storageKey: 'sb-auth-token',
      retryInterval: 1000,
      retryIntervalMax: 5000,
      retryAttempts: 3
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

// Admin utility functions
export const adminUtils = {
  async deleteUser(userId: string) {
    const headers = {
      'Authorization': `Bearer ${config.supabase.serviceKey}`,
      'apikey': config.supabase.serviceKey
    };

    try {
      // Delete user data using RPC function
      const { error: rpcError } = await supabase
        .rpc('delete_user_data', { user_id_param: userId });

      if (rpcError) {
        if (rpcError.message.includes('Cannot delete the last super admin')) {
          throw new Error('Impossible de supprimer le dernier super administrateur');
        }
        throw rpcError;
      }

      // Delete auth user using admin endpoint
      const response = await fetch(
        `${config.supabase.url}/auth/v1/admin/users/${userId}`,
        {
          method: 'DELETE',
          headers
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete auth user');
      }
    } catch (error) {
      throw error;
    }
  },

  async createUser(email: string, password: string, role: string) {
    const headers = {
      'Authorization': `Bearer ${config.supabase.serviceKey}`,
      'apikey': config.supabase.serviceKey,
      'Content-Type': 'application/json'
    };

    try {
      const response = await fetch(
        `${config.supabase.url}/auth/v1/admin/users`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email,
            password,
            email_confirm: true,
            user_metadata: { role }
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create user');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  },

  async updateUserRole(userId: string, role: string) {
    const headers = {
      'Authorization': `Bearer ${config.supabase.serviceKey}`,
      'apikey': config.supabase.serviceKey,
      'Content-Type': 'application/json'
    };

    try {
      const response = await fetch(
        `${config.supabase.url}/auth/v1/admin/users/${userId}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            user_metadata: { role }
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update user role');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }
};

// Export singleton instance
export const supabase = createSupabaseClient();

// Initialize auth state
supabase.auth.getSession().catch(async error => {
  try {
    await handleError(error, {
      component: 'supabase',
      action: 'getInitialSession'
    });

    // Clear session and redirect on auth errors
    if (error instanceof Error && 
        (error.message.includes('JWT expired') || 
         error.message.includes('Invalid JWT') ||
         error.message.includes('session_not_found'))) {
      await supabase.auth.signOut();
      localStorage.clear();
      window.location.href = '/login';
    }
  } catch (err) {
    console.error('Critical error during session check:', err);
    localStorage.clear();
    window.location.href = '/login';
  }
});

// Set up auth state change listener
supabase.auth.onAuthStateChange(async (event, session) => {
  try {
    if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
      localStorage.clear();
      window.location.href = '/login';
    } else if (event === 'TOKEN_REFRESHED') {
      // Silent refresh successful
    } else if (event === 'SIGNED_IN') {
      // Validate session on sign in
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Invalid session after sign in');
      }
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
  clearTimeout(refreshTimeout);
  refreshTimeout = setTimeout(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        throw new Error('No valid session');
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