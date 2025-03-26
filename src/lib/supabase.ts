import { createClient } from '@supabase/supabase-js';
import { config } from './config';
import { handleError } from './errorHandler';
import { AuthErrorType } from './errorTypes';
import { sessionManager } from './sessionManager';

// Create Supabase client with better config
const supabase = createClient(config.supabase.url, config.supabase.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: sessionStorage,
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

// Admin utilities for user management
export const adminUtils = {
  /**
   * Create a new user
   */
  async createUser(email: string, password: string, role: string) {
    try {
      const response = await fetch('/functions/v1/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.supabase.anonKey}`
        },
        body: JSON.stringify({ email, password, role })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user');
      }

      return response.json();
    } catch (error) {
      throw await handleError(error, {
        component: 'adminUtils',
        action: 'createUser',
        email
      });
    }
  },

  /**
   * Delete a user
   */
  async deleteUser(userId: string) {
    try {
      const response = await fetch('/functions/v1/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.supabase.anonKey}`
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

// Handle auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
  try {
    console.debug('🔄 Auth state change:', event);

    switch (event) {
      case 'SIGNED_IN':
        if (!session) {
          throw new Error('No session after sign in');
        }
        // Validate session and profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('status, role')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profile?.status) {
          throw new Error('Profile inactive or not found');
        }

        // Store role in sessionStorage
        sessionStorage.setItem('userRole', profile.role);
        break;

      case 'SIGNED_OUT':
      case 'USER_DELETED':
        console.debug('👋 User signed out or deleted');
        sessionStorage.clear();
        localStorage.clear();
        window.location.href = '/login';
        break;

      case 'TOKEN_REFRESHED':
        console.debug('🔄 Token refreshed');
        break;

      default:
        console.debug('ℹ️ Unhandled auth event:', event);
        break;
    }
  } catch (error) {
    await handleError(error, {
      component: 'supabase',
      action: 'handleAuthStateChange',
      event
    });

    // Clear session and redirect on auth errors
    sessionStorage.clear();
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
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        throw new Error('No valid session');
      }

      // Validate profile is still active
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', session.user.id)
        .single();

      if (profileError || !profile?.status) {
        throw new Error('Profile inactive');
      }
    } catch (error) {
      await handleError(error, {
        component: 'supabase',
        action: 'refreshSession'
      });

      // Clear session and redirect on auth errors
      sessionStorage.clear();
      localStorage.clear();
      window.location.href = '/login';
    }
  }, 1000);
});

export { supabase };
export default supabase;