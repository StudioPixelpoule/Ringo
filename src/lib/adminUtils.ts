import { supabase } from './supabase';
import { handleError } from './errorHandler';
import { AuthErrorType } from './errorTypes';

/**
 * Admin utilities for user management
 */
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
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
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
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
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