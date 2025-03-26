import { create } from 'zustand';
import { supabase, adminUtils } from './supabase';
import { handleError } from './errorHandler';

export interface Profile {
  id: string;
  email: string;
  role: 'super_admin' | 'g_admin' | 'admin' | 'user';
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
  userRole: string;
  
  fetchUsers: () => Promise<void>;
  updateUser: (id: string, data: Partial<Profile>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  setSelectedUser: (user: Profile | null) => void;
  setModalOpen: (isOpen: boolean) => void;
  clearError: () => void;
  setUserRole: (role: string) => void;
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ users: data || [] });

      // Get current user's role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        set({ userRole: profile.role });
      }
    } catch (error) {
      const appError = await handleError(error, {
        component: 'UserStore',
        action: 'fetchUsers'
      });
      set({ error: appError.getUserMessage() });
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
      const appError = await handleError(error, {
        component: 'UserStore',
        action: 'updateUser'
      });
      set({ error: appError.getUserMessage() });
    } finally {
      set({ loading: false });
    }
  },

  deleteUser: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await adminUtils.deleteUser(id);
      const users = get().users;
      set({ users: users.filter(u => u.id !== id) });
    } catch (error) {
      const appError = await handleError(error, {
        component: 'UserStore',
        action: 'deleteUser'
      });
      set({ error: appError.getUserMessage() });
    } finally {
      set({ loading: false });
    }
  },

  setSelectedUser: (user: Profile | null) => set({ selectedUser: user }),
  setModalOpen: (isOpen: boolean) => set({ isModalOpen: isOpen }),
  clearError: () => set({ error: null }),
  setUserRole: (role: string) => set({ userRole: role })
}));