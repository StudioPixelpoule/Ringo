import { create } from 'zustand';
import { supabase } from './supabase';
import { processDocument } from './documentProcessor';
import { DocumentCache } from './documentCache';

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
  processed: boolean;
  created_at: string;
  size?: number;
}

interface ProcessingStatus {
  isProcessing: boolean;
  progress: number;
  stage: 'preparation' | 'processing' | 'extraction' | 'complete' | 'upload';
  message: string;
  canCancel?: boolean;
}

interface DocumentStore {
  folders: Folder[];
  documents: Document[];
  currentFolder: Folder | null;
  isModalOpen: boolean;
  loading: boolean;
  error: string | null;
  processingStatus: ProcessingStatus;
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
  clearError: () => void;
}

const documentCache = new DocumentCache();

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
    stage: 'preparation',
    message: ''
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
      set({ error: error instanceof Error ? error.message : 'Error creating folder' });
    } finally {
      set({ loading: false });
    }
  },

  uploadDocument: async (file, folderId, metadata) => {
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
      // Check cache first
      const cachedResult = await documentCache.get(file);
      
      if (cachedResult) {
        set({ 
          processingStatus: {
            isProcessing: true,
            progress: 50,
            stage: 'upload',
            message: 'Document trouvé en cache...',
            canCancel: true
          }
        });
      }

      // Process document if not in cache
      const result = cachedResult || await processDocument(file, {
        openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY,
        onProgress: (progress) => {
          set({ processingStatus: progress });
        }
      });

      // Cache the result if it wasn't cached
      if (!cachedResult) {
        await documentCache.set(file, result);
      }

      set({ 
        processingStatus: {
          isProcessing: true,
          progress: 75,
          stage: 'upload',
          message: 'Enregistrement...',
          canCancel: true
        }
      });

      // Upload file to storage
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
      if (!data?.path) throw new Error('Échec upload: Pas de chemin retourné');

      uploadedPath = data.path;

      // Create document record
      const { data: doc, error: dbError } = await supabase
        .from('documents')
        .insert([{
          folder_id: folderId,
          name: file.name,
          type: fileExt,
          url: data.path,
          content: JSON.stringify(result),
          processed: true,
          size: file.size,
          ...metadata,
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      const documents = get().documents;
      set({ documents: [...documents, doc] });

      return doc;
    } catch (error) {
      // Clean up on error
      if (uploadedPath) {
        await supabase.storage
          .from('documents')
          .remove([uploadedPath])
          .catch(console.error);
      }

      console.error('Upload error:', error);
      set({ error: error instanceof Error ? error.message : 'Error uploading document' });
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
      set({ error: error instanceof Error ? error.message : 'Error fetching folders' });
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
      set({ error: error instanceof Error ? error.message : 'Error fetching documents' });
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
      set({ error: error instanceof Error ? error.message : 'Error fetching documents' });
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
      set({ error: error instanceof Error ? error.message : 'Error deleting folder' });
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
      set({ error: error instanceof Error ? error.message : 'Error renaming folder' });
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

  clearError: () => set({ error: null }),
}));