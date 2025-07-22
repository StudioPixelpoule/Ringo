import { create } from 'zustand';
import { supabase } from './supabase';

export interface Profile {
  id: string;
  email: string;
  role: 'super_admin' | 'admin' | 'user';
  status: boolean;
  created_at: string;
  updated_at: string;
  name?: string;
}

interface UserStore {
  users: Profile[];
  loading: boolean;
  error: string | null;
  selectedUser: Profile | null;
  isModalOpen: boolean;
  userRole: string;
  
  fetchUsers: () => Promise<void>;
  updateUser: (id: string, data: Partial<Profile>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  createUser: (data: { email: string; password: string; role: Profile['role'] }) => Promise<void>;
  setSelectedUser: (user: Profile | null) => void;
  setModalOpen: (isOpen: boolean) => void;
  clearError: () => void;
}

export const useUserStore = create<UserStore>((set, get) => ({
  users: [],
  loading: false,
  error: null,
  selectedUser: null,
  isModalOpen: false,
  userRole: 'user',

  fetchUsers: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ users: data as Profile[] });

      // Get current user's role
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          set({ userRole: profile.role });
        }
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch users' });
    } finally {
      set({ loading: false });
    }
  },

  createUser: async ({ email, password, role }) => {
    set({ loading: true, error: null });
    try {
      // Check if user exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (existingUser) {
        throw new Error('Un utilisateur avec cet email existe déjà');
      }

      // Call Edge Function to create user
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, role })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create user');
      }

      // Refresh user list
      await get().fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to create user' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  updateUser: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await get().fetchUsers();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update user' });
    } finally {
      set({ loading: false });
    }
  },

  deleteUser: async (id) => {
    set({ loading: true, error: null });
    try {
      // First check if user exists and get their role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', id)
        .single();

      if (profileError) throw new Error('Failed to fetch user profile');
      if (!profile) throw new Error('User not found');

      // Don't allow deleting the last super admin
      if (profile.role === 'super_admin') {
        const { count, error: countError } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'super_admin')
          .eq('status', true);

        if (countError) throw new Error('Failed to check super admin count');
        if (count === 1) throw new Error('Cannot delete the last super admin');
      }

      // Call Edge Function to delete user
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: id })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server response:', errorData);
        throw new Error(errorData.error || `Failed to delete user: ${response.status} ${response.statusText}`);
      }

      // Update local state
      const users = get().users;
      set({ users: users.filter(u => u.id !== id) });
    } catch (error) {
      console.error('Error deleting user:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to delete user' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  setSelectedUser: (user: Profile | null) => set({ selectedUser: user }),
  setModalOpen: (isOpen: boolean) => set({ isModalOpen: isOpen }),
  clearError: () => set({ error: null }),
}));