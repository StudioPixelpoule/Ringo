import { create } from 'zustand';
import { supabase } from './supabase';
import { createInvitation, UserInvitation } from './invitationService';

export interface Profile {
  id: string;
  email: string;
  role: 'super_admin' | 'admin' | 'user';
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
  userRole: string;
  invitations: UserInvitation[];
  
  fetchUsers: () => Promise<void>;
  updateUser: (id: string, data: Partial<Profile>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  inviteUser: (email: string, role: Profile['role']) => Promise<void>;
  fetchInvitations: () => Promise<void>;
  revokeInvitation: (id: string) => Promise<void>;
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
  userRole: 'user',
  invitations: [],

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

  inviteUser: async (email: string, role: Profile['role']) => {
    set({ loading: true, error: null });
    try {
      const invitation = await createInvitation(email, role);
      
      // Update invitations list
      const invitations = get().invitations;
      set({ invitations: [invitation, ...invitations] });
      
      // Close modal
      set({ isAddUserModalOpen: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to invite user' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  fetchInvitations: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ invitations: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch invitations' });
    } finally {
      set({ loading: false });
    }
  },

  revokeInvitation: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('user_invitations')
        .update({ status: 'revoked' })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      const invitations = get().invitations.map(inv =>
        inv.id === id ? { ...inv, status: 'revoked' } : inv
      );
      set({ invitations });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to revoke invitation' });
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
      set({ error: error instanceof Error ? error.message : 'Failed to update user' });
    } finally {
      set({ loading: false });
    }
  },

  deleteUser: async (id: string) => {
    set({ loading: true, error: null });
    try {
      // First deactivate the user
      const { error: deactivateError } = await supabase
        .from('profiles')
        .update({ 
          status: false, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (deactivateError) throw deactivateError;

      // Then delete the profile
      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Update local state
      const users = get().users;
      set({ users: users.filter(u => u.id !== id) });
    } catch (error) {
      console.error('Error deleting user:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to delete user' });
    } finally {
      set({ loading: false });
    }
  },

  setSelectedUser: (user: Profile | null) => set({ selectedUser: user }),
  setModalOpen: (isOpen: boolean) => set({ isModalOpen: isOpen }),
  setAddUserModalOpen: (isOpen: boolean) => set({ isAddUserModalOpen: isOpen }),
  clearError: () => set({ error: null }),
}));