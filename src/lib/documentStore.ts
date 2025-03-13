import { create } from 'zustand';
import { supabase } from './supabase';
import { processDocument } from './documentProcessor';

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
    let documentId: string | null = null;

    try {
      // Process document content first
      const content = await processDocument(file, {
        onProgress: (progress) => {
          set({
            processingStatus: {
              isProcessing: true,
              progress: progress.progress * 0.7, // 70% of total progress
              stage: 'processing',
              message: progress.message,
              canCancel: true
            }
          });
        }
      });

      if (!content) {
        throw new Error('Échec du traitement du document');
      }

      // Upload file to storage
      set({
        processingStatus: {
          isProcessing: true,
          progress: 70,
          stage: 'upload',
          message: 'Téléversement du fichier...',
          canCancel: true
        }
      });

      const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });

      if (uploadError) throw uploadError;
      if (!uploadData?.path) throw new Error('Échec upload: Pas de chemin retourné');

      uploadedPath = uploadData.path;

      // Create document record
      set({
        processingStatus: {
          isProcessing: true,
          progress: 80,
          stage: 'processing',
          message: 'Création de l\'enregistrement...',
          canCancel: true
        }
      });

      const { data: doc, error: dbError } = await supabase
        .from('documents')
        .insert([{
          folder_id: folderId,
          name: file.name,
          type: fileExt,
          url: uploadData.path,
          size: file.size,
          ...metadata
        }])
        .select()
        .single();

      if (dbError) throw dbError;
      if (!doc) throw new Error('Aucune donnée retournée lors de la création');

      documentId = doc.id;

      // Store document content
      set({
        processingStatus: {
          isProcessing: true,
          progress: 90,
          stage: 'processing',
          message: 'Enregistrement du contenu...',
          canCancel: true
        }
      });

      const { error: contentError } = await supabase
        .from('document_contents')
        .insert([{
          document_id: doc.id,
          content: content
        }]);

      if (contentError) throw contentError;

      // Update local state
      const documents = get().documents;
      const processedDoc = { ...doc, processed: true };
      set({ documents: [...documents, processedDoc] });

      set({
        processingStatus: {
          isProcessing: false,
          progress: 100,
          stage: 'complete',
          message: 'Document traité avec succès !',
          canCancel: false
        }
      });

      return processedDoc;
    } catch (error) {
      // Clean up on error
      if (uploadedPath) {
        await supabase.storage
          .from('documents')
          .remove([uploadedPath])
          .catch(console.error);
      }

      if (documentId) {
        await supabase
          .from('documents')
          .delete()
          .eq('id', documentId)
          .catch(console.error);
      }

      console.error('🚨 Error in uploadDocument:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erreur lors du téléversement',
        processingStatus: {
          isProcessing: false,
          progress: 0,
          stage: 'upload',
          message: '',
          canCancel: false
        }
      });
      throw error;
    } finally {
      set({ loading: false });
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

  clearError: () => set({ error: null }),
}));