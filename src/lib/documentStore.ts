import { create } from 'zustand';
import { supabase } from './supabase';
import { processDocument } from './universalProcessor';
import { handleStoreError, withErrorHandling } from './errorHandler';

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
  stage: 'upload' | 'processing' | 'complete';
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

  createFolder: withErrorHandling(async (name, parentId) => {
    set({ loading: true, error: null });
    try {
      console.log("📁 Creating folder:", { name, parentId });
      
      const { data, error } = await supabase
        .from('folders')
        .insert([{ name, parent_id: parentId }])
        .select()
        .single();

      if (error) throw error;
      
      const folders = get().folders;
      set({ folders: [...folders, data] });
      
      console.log("✅ Folder created:", data);
    } finally {
      set({ loading: false });
    }
  }, { store: 'DocumentStore', action: 'createFolder' }),

  uploadDocument: withErrorHandling(async (file, folderId, metadata) => {
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
      console.log("📄 Processing document:", file.name);

      const result = await processDocument(file, {
        openaiApiKey: process.env.VITE_OPENAI_API_KEY,
        onProgress: (progress) => {
          set({ processingStatus: progress });
        },
        signal: abortController.signal
      });

      if (!result) {
        throw new Error('Document processing failed');
      }

      console.log("✅ Document processed");
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
      console.log("✅ File uploaded:", uploadedPath);

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
          content: result
        }]);

      if (contentError) throw contentError;

      console.log("✅ Document saved:", doc);

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

      const errorMessage = await handleStoreError(error, 'DocumentStore', 'uploadDocument');
      set({ error: errorMessage });
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
  }, { store: 'DocumentStore', action: 'uploadDocument' }),

  fetchFolders: withErrorHandling(async () => {
    set({ loading: true, error: null });
    try {
      console.log("📁 Fetching folders");
      
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      console.log("✅ Folders fetched:", data?.length || 0);
      set({ folders: data || [] });
    } finally {
      set({ loading: false });
    }
  }, { store: 'DocumentStore', action: 'fetchFolders' }),

  fetchDocuments: withErrorHandling(async (folderId) => {
    set({ loading: true, error: null });
    try {
      console.log("📄 Fetching folder documents:", folderId);
      
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('folder_id', folderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log("✅ Documents fetched:", data?.length || 0);
      set({ documents: data || [] });
    } finally {
      set({ loading: false });
    }
  }, { store: 'DocumentStore', action: 'fetchDocuments' }),

  fetchAllDocuments: withErrorHandling(async () => {
    set({ loading: true, error: null });
    try {
      console.log("📄 Fetching all documents");
      
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log("✅ Documents fetched:", data?.length || 0);
      set({ documents: data || [] });
    } finally {
      set({ loading: false });
    }
  }, { store: 'DocumentStore', action: 'fetchAllDocuments' }),

  setCurrentFolder: (folder) => set({ currentFolder: folder }),

  deleteFolder: withErrorHandling(async (id) => {
    set({ loading: true, error: null });
    try {
      console.log("🗑️ Deleting folder:", id);
      
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      const folders = get().folders;
      set({ folders: folders.filter((f) => f.id !== id) });
      
      console.log("✅ Folder deleted");
    } finally {
      set({ loading: false });
    }
  }, { store: 'DocumentStore', action: 'deleteFolder' }),

  renameFolder: withErrorHandling(async (id, newName) => {
    set({ loading: true, error: null });
    try {
      console.log("✏️ Renaming folder:", { id, newName });
      
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
      
      console.log("✅ Folder renamed");
    } finally {
      set({ loading: false });
    }
  }, { store: 'DocumentStore', action: 'renameFolder' }),

  selectDocument: (id) => {
    console.log("📄 Selecting document:", id);
    set((state) => ({
      selectedDocuments: [...state.selectedDocuments, id]
    }));
  },

  unselectDocument: (id) => {
    console.log("📄 Deselecting document:", id);
    set((state) => ({
      selectedDocuments: state.selectedDocuments.filter(docId => docId !== id)
    }));
  },

  clearSelectedDocuments: () => {
    console.log("🧹 Clearing selection");
    set({ selectedDocuments: [] });
  },

  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));