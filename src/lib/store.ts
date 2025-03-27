import { create } from 'zustand';
import { supabase } from './supabase';

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

      // Create user with auth API
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password,
        options: {
          data: { role },
          emailRedirectTo: `${window.location.origin}/login`
        }
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Échec de la création de l\'utilisateur');

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: authData.user.id,
          email: email.toLowerCase(),
          role,
          status: true
        }]);

      if (profileError) {
        // Rollback: delete auth user if profile creation fails
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw profileError;
      }

      // Refresh user list
      await get().fetchUsers();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create user' });
      throw error;
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

      // Delete user data
      const { error: deleteError } = await supabase
        .rpc('delete_user_data_v2', { user_id_param: id });

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
  clearError: () => set({ error: null }),
}));