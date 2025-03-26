import { create } from 'zustand';
import { supabase } from './supabase';
import { processDocument } from './universalProcessor';
import { handleError } from './errorHandler';
import { Document, Folder, StoreState, ProcessingProgress } from './types';

interface DocumentStore extends StoreState {
  folders: Folder[];
  documents: Document[];
  currentFolder: Folder | null;
  isModalOpen: boolean;
  processingStatus: ProcessingProgress;
  selectedDocuments: string[];
  
  setModalOpen: (isOpen: boolean) => void;
  createFolder: (name: string, parentId: string | null) => Promise<void>;
  uploadDocument: (file: File, folderId: string, metadata: Partial<Document>) => Promise<Document>;
  fetchFolders: () => Promise<void>;
  fetchDocuments: (folderId: string) => Promise<void>;
  fetchAllDocuments: () => Promise<void>;
  setCurrentFolder: (folder: Folder | null) => void;
  deleteFolder: (id: string) => Promise<void>;
  renameFolder: (id: string, newName: string) => Promise<void>;
  selectDocument: (id: string) => void;
  unselectDocument: (id: string) => void;
  clearSelectedDocuments: () => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  folders: [],
  documents: [],
  currentFolder: null,
  isModalOpen: false,
  loading: false,
  error: null,
  processingStatus: {
    isProcessing: false,
    progress: 0,
    stage: 'upload',
    message: '',
    canCancel: false
  },
  selectedDocuments: [],

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
      
      const folders = get().folders;
      set({ folders: [...folders, data] });
    } catch (error) {
      const appError = await handleError(error, {
        component: 'DocumentStore',
        action: 'createFolder'
      });
      set({ error: appError.getUserMessage() });
    } finally {
      set({ loading: false });
    }
  },

  uploadDocument: async (file, folderId, metadata) => {
    const abortController = new AbortController();
    
    set({
      loading: true,
      error: null,
      processingStatus: {
        isProcessing: true,
        progress: 0,
        stage: 'upload',
        message: 'Préparation...',
        canCancel: true
      }
    });

    let uploadedPath: string | null = null;

    try {
      const result = await processDocument(file, {
        openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY,
        onProgress: (progress) => {
          set({ processingStatus: progress });
        },
        signal: abortController.signal
      });

      if (!result) {
        throw new Error('Document processing failed');
      }

      set({ processingStatus: {
        isProcessing: true,
        progress: 75,
        stage: 'upload',
        message: 'Saving...',
        canCancel: true
      }});

      const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });

      if (uploadError) throw uploadError;
      if (!data?.path) throw new Error('Upload failed: No path returned');

      uploadedPath = data.path;

      const { data: doc, error: dbError } = await supabase
        .from('documents')
        .insert([{
          folder_id: folderId,
          name: file.name,
          type: fileExt,
          url: data.path,
          size: file.size,
          ...metadata,
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      const { error: contentError } = await supabase
        .from('document_contents')
        .insert([{
          document_id: doc.id,
          content: result.content
        }]);

      if (contentError) throw contentError;

      const documents = get().documents;
      set({ documents: [...documents, doc] });

      return doc;
    } catch (error) {
      if (uploadedPath) {
        await supabase.storage
          .from('documents')
          .remove([uploadedPath])
          .catch(console.error);
      }

      const appError = await handleError(error, {
        component: 'DocumentStore',
        action: 'uploadDocument'
      });
      set({ error: appError.getUserMessage() });
      throw error;
    } finally {
      set({
        loading: false,
        processingStatus: {
          isProcessing: false,
          progress: 0,
          stage: 'upload',
          message: '',
          canCancel: false
        }
      });
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
      const appError = await handleError(error, {
        component: 'DocumentStore',
        action: 'fetchFolders'
      });
      set({ error: appError.getUserMessage() });
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
      const appError = await handleError(error, {
        component: 'DocumentStore',
        action: 'fetchDocuments'
      });
      set({ error: appError.getUserMessage() });
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
      const appError = await handleError(error, {
        component: 'DocumentStore',
        action: 'fetchAllDocuments'
      });
      set({ error: appError.getUserMessage() });
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
      
      const folders = get().folders;
      set({ folders: folders.filter((f) => f.id !== id) });
    } catch (error) {
      const appError = await handleError(error, {
        component: 'DocumentStore',
        action: 'deleteFolder'
      });
      set({ error: appError.getUserMessage() });
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
      
      const folders = get().folders;
      set({
        folders: folders.map((f) =>
          f.id === id ? { ...f, name: newName } : f
        ),
      });
    } catch (error) {
      const appError = await handleError(error, {
        component: 'DocumentStore',
        action: 'renameFolder'
      });
      set({ error: appError.getUserMessage() });
    } finally {
      set({ loading: false });
    }
  },

  selectDocument: (id) => {
    set((state) => ({
      selectedDocuments: [...state.selectedDocuments, id]
    }));
  },

  unselectDocument: (id) => {
    set((state) => ({
      selectedDocuments: state.selectedDocuments.filter(docId => docId !== id)
    }));
  },

  clearSelectedDocuments: () => {
    set({ selectedDocuments: [] });
  },

  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));