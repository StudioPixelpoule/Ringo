import { createClient } from '@supabase/supabase-js';
import { config } from './config';

// Create Supabase client with better config
const supabaseInstance = createClient(config.supabase.url, config.supabase.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: sessionStorage,
    storageKey: 'sb-auth-token',
    flowType: 'pkce',
    debug: import.meta.env.DEV
  },
  global: {
    headers: {
      'x-application-name': 'ringo',
      'x-client-info': `ringo/${config.app.version}`
    }
  }
});

// Export singleton instance
export const supabase = supabaseInstance;

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
      console.error('Error creating user:', error);
      throw error;
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
      console.error('Error deleting user:', error);
      throw error;
    }
  }
};

// Initialize auth state
supabase.auth.getSession().catch(error => {
  console.error('Error getting initial session:', error);
  sessionStorage.clear();
  window.location.href = '/login';
});

// Set up auth state change listener
supabase.auth.onAuthStateChange((event, session) => {
  console.debug('🔄 Auth state change:', event);

  if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = '/login';
  } else if (event === 'TOKEN_REFRESHED') {
    console.debug('✅ Token refreshed successfully');
  } else if (event === 'SIGNED_IN') {
    console.debug('✅ Sign in successful');
  }
});

export default supabase;