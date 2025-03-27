import { create } from 'zustand';
import { supabase } from './supabase';
import { processDocument } from './universalProcessor';

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
  is_chunked?: boolean;
  manifest_path?: string;
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
  uploadDocument: (file: File, folderId: string, metadata: Partial<Document>, options?: { signal?: AbortSignal; onProgress?: (progress: ProcessingStatus) => void }) => Promise<Document>;
  fetchFolders: () => Promise<void>;
  fetchDocuments: (folderId: string) => Promise<void>;
  fetchAllDocuments: () => Promise<void>;
  setCurrentFolder: (folder: Folder | null) => void;
  deleteFolder: (id: string) => Promise<void>;
  renameFolder: (id: string, newName: string) => Promise<void>;
  selectDocument: (id: string) => void;
  unselectDocument: (id: string) => void;
  clearSelectedDocuments: () => void;
  setError: (error: string) => void;
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
      console.log("📁 Création du dossier:", { name, parentId });
      
      const { data, error } = await supabase
        .from('folders')
        .insert([{ name, parent_id: parentId }])
        .select()
        .single();

      if (error) throw error;
      
      const folders = get().folders;
      set({ folders: [...folders, data] });
      
      console.log("✅ Dossier créé:", data);
    } catch (error) {
      console.error("🚨 Erreur création dossier:", error);
      set({ error: error instanceof Error ? error.message : 'Erreur création dossier' });
    } finally {
      set({ loading: false });
    }
  },

  uploadDocument: async (file, folderId, metadata, options) => {
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

    try {
      console.log("📄 Traitement du document:", file.name);

      // Create document record first
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert([{
          folder_id: folderId,
          name: file.name,
          type: metadata.type,
          description: metadata.description,
          url: metadata.url,
          size: metadata.size,
          is_chunked: metadata.is_chunked,
          manifest_path: metadata.manifest_path,
          processed: false
        }])
        .select()
        .single();

      if (docError) throw docError;

      // Process document content
      const result = await processDocument(file, {
        openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY,
        onProgress: (progress) => {
          options?.onProgress?.(progress);
          set({ processingStatus: progress });
        },
        signal: options?.signal
      });

      if (!result) {
        throw new Error('Échec du traitement du document');
      }

      // Store document content
      const { error: contentError } = await supabase
        .from('document_contents')
        .insert([{
          document_id: doc.id,
          content: result,
          is_chunked: metadata.is_chunked || false,
          chunk_index: metadata.is_chunked ? 0 : null,
          total_chunks: metadata.is_chunked ? 1 : null
        }]);

      if (contentError) throw contentError;

      // Update document as processed
      const { error: updateError } = await supabase
        .from('documents')
        .update({ processed: true })
        .eq('id', doc.id);

      if (updateError) throw updateError;

      const documents = get().documents;
      set({ documents: [...documents, { ...doc, processed: true }] });

      return { ...doc, processed: true };
    } catch (error) {
      console.error("🚨 Erreur upload document:", error);
      set({ error: error instanceof Error ? error.message : 'Erreur upload document' });
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
      console.log("📁 Récupération des dossiers");
      
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      console.log("✅ Dossiers récupérés:", data?.length || 0);
      set({ folders: data || [] });
    } catch (error) {
      console.error("🚨 Erreur récupération dossiers:", error);
      set({ error: error instanceof Error ? error.message : 'Erreur récupération dossiers' });
    } finally {
      set({ loading: false });
    }
  },

  fetchDocuments: async (folderId) => {
    set({ loading: true, error: null });
    try {
      console.log("📄 Récupération des documents du dossier:", folderId);
      
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('folder_id', folderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log("✅ Documents récupérés:", data?.length || 0);
      set({ documents: data || [] });
    } catch (error) {
      console.error("🚨 Erreur récupération documents:", error);
      set({ error: error instanceof Error ? error.message : 'Erreur récupération documents' });
    } finally {
      set({ loading: false });
    }
  },

  fetchAllDocuments: async () => {
    set({ loading: true, error: null });
    try {
      console.log("📄 Récupération de tous les documents");
      
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log("✅ Documents récupérés:", data?.length || 0);
      set({ documents: data || [] });
    } catch (error) {
      console.error("🚨 Erreur récupération documents:", error);
      set({ error: error instanceof Error ? error.message : 'Erreur récupération documents' });
    } finally {
      set({ loading: false });
    }
  },

  setCurrentFolder: (folder) => set({ currentFolder: folder }),

  deleteFolder: async (id) => {
    set({ loading: true, error: null });
    try {
      console.log("🗑️ Suppression du dossier:", id);
      
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      const folders = get().folders;
      set({ folders: folders.filter((f) => f.id !== id) });
      
      console.log("✅ Dossier supprimé");
    } catch (error) {
      console.error("🚨 Erreur suppression dossier:", error);
      set({ error: error instanceof Error ? error.message : 'Erreur suppression dossier' });
    } finally {
      set({ loading: false });
    }
  },

  renameFolder: async (id, newName) => {
    set({ loading: true, error: null });
    try {
      console.log("✏️ Renommage du dossier:", { id, newName });
      
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
      
      console.log("✅ Dossier renommé");
    } catch (error) {
      console.error("🚨 Erreur renommage dossier:", error);
      set({ error: error instanceof Error ? error.message : 'Erreur renommage dossier' });
    } finally {
      set({ loading: false });
    }
  },

  selectDocument: (id) => {
    console.log("📄 Sélection du document:", id);
    set((state) => ({
      selectedDocuments: [...state.selectedDocuments, id]
    }));
  },

  unselectDocument: (id) => {
    console.log("📄 Désélection du document:", id);
    set((state) => ({
      selectedDocuments: state.selectedDocuments.filter(docId => docId !== id)
    }));
  },

  clearSelectedDocuments: () => {
    console.log("🧹 Effacement de la sélection");
    set({ selectedDocuments: [] });
  },

  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));