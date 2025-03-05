import { create } from 'zustand';
import { supabase } from './supabase';

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  folder_id: string;
  name: string;
  type: string;
  group_name: string;
  description: string;
  url: string;
  created_at: string;
}

interface DocumentStore {
  folders: Folder[];
  documents: Document[];
  currentFolder: Folder | null;
  isModalOpen: boolean;
  loading: boolean;
  error: string | null;
  uploadProgress: number;
  
  // Actions
  setModalOpen: (isOpen: boolean) => void;
  createFolder: (name: string, parentId: string | null) => Promise<void>;
  uploadDocument: (file: File, folderId: string, metadata: Partial<Document>) => Promise<void>;
  fetchFolders: () => Promise<void>;
  fetchDocuments: (folderId: string) => Promise<void>;
  fetchAllDocuments: () => Promise<void>;
  setCurrentFolder: (folder: Folder | null) => void;
  deleteFolder: (id: string) => Promise<void>;
  renameFolder: (id: string, newName: string) => Promise<void>;
  clearError: () => void;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  folders: [],
  documents: [],
  currentFolder: null,
  isModalOpen: false,
  loading: false,
  error: null,
  uploadProgress: 0,

  setModalOpen: (isOpen) => set({ isModalOpen: isOpen }),

  createFolder: async (name, parentId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('folders')
        .insert([{ name, parent_id: parentId }])
        .select()
        .single();

      if (error) throw error;
      
      // Update local folders state
      const folders = get().folders;
      set({ folders: [...folders, data] });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  uploadDocument: async (file, folderId, metadata) => {
    set({ loading: true, error: null, uploadProgress: 0 });
    try {
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          onUploadProgress: (progress) => {
            const percentage = (progress.loaded / progress.total) * 100;
            set({ uploadProgress: percentage });
          },
        });

      if (uploadError) throw uploadError;

      // Create document record
      const { error: dbError } = await supabase
        .from('documents')
        .insert([{
          folder_id: folderId,
          name: file.name,
          type: fileExt,
          url: data?.path,
          ...metadata,
        }]);

      if (dbError) throw dbError;

      // Refresh documents list
      await get().fetchDocuments(folderId);
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false, uploadProgress: 0 });
    }
  },

  fetchFolders: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      set({ folders: data || [] });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchDocuments: async (folderId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('folder_id', folderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ documents: data || [] });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchAllDocuments: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ documents: data || [] });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  setCurrentFolder: (folder) => set({ currentFolder: folder }),

  deleteFolder: async (id) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Update local folders state
      const folders = get().folders;
      set({ folders: folders.filter((f) => f.id !== id) });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  renameFolder: async (id, newName) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('folders')
        .update({ name: newName })
        .eq('id', id);

      if (error) throw error;
      
      // Update local folders state
      const folders = get().folders;
      set({
        folders: folders.map((f) =>
          f.id === id ? { ...f, name: newName } : f
        ),
      });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));