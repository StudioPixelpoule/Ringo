import { create } from 'zustand';
import { supabase } from './supabase';

export interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'user';
  status: boolean;
  created_at: string;
  updated_at: string;
}

interface UserStore {
  users: Profile[];
  loading: boolean;
  error: string | null;
  selectedUser: Profile | null;
  isModalOpen: boolean;
  isAddUserModalOpen: boolean;
  fetchUsers: () => Promise<void>;
  updateUser: (id: string, data: Partial<Profile>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  createUser: (email: string, password: string, role: 'admin' | 'user') => Promise<void>;
  setSelectedUser: (user: Profile | null) => void;
  setModalOpen: (isOpen: boolean) => void;
  setAddUserModalOpen: (isOpen: boolean) => void;
  clearError: () => void;
}

export const useUserStore = create<UserStore>((set, get) => ({
  users: [],
  loading: false,
  error: null,
  selectedUser: null,
  isModalOpen: false,
  isAddUserModalOpen: false,

  fetchUsers: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ users: data as Profile[] });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  createUser: async (email: string, password: string, role: 'admin' | 'user') => {
    set({ loading: true, error: null });
    try {
      // First create the auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: role
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Failed to create user');

      // Wait a moment for the trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update the profile with the role
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          role,
          status: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', authData.user.id);

      if (updateError) throw updateError;

      await get().fetchUsers();
      set({ isAddUserModalOpen: false });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  updateUser: async (id: string, data: Partial<Profile>) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await get().fetchUsers();
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  deleteUser: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await get().fetchUsers();
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  setSelectedUser: (user: Profile | null) => set({ selectedUser: user }),
  setModalOpen: (isOpen: boolean) => set({ isModalOpen: isOpen }),
  setAddUserModalOpen: (isOpen: boolean) => set({ isAddUserModalOpen: isOpen }),
  clearError: () => set({ error: null }),
}));