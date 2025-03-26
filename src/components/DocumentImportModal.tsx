import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, FolderPlus, ChevronRight, Edit2, Trash2, Loader2, CheckSquare, Square } from 'lucide-react';
import { useDocumentStore, Document, Folder } from '../lib/documentStore';
import { supabase } from '../lib/supabase';
import { FileIcon } from './FileIcon';
import { logError } from '../lib/errorLogger';
import { FolderModal } from './FolderModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { processDocument } from '../lib/documentProcessor';
import { validateFileSize } from '../lib/constants';
import { ProcessingProgress, ModalProps } from '../lib/types';
import { config } from '../lib/config';

interface FolderTreeItemProps {
  folder: Folder;
  level: number;
  selectedFolder: Folder | null;
  expandedFolders: Set<string>;
  onSelect: (folder: Folder) => void;
  onToggle: (folderId: string) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteClick: (folder: Folder) => void;
  folders: Folder[];
}

const FolderTreeItem: React.FC<FolderTreeItemProps> = ({
  folder,
  level,
  selectedFolder,
  expandedFolders,
  onSelect,
  onToggle,
  onCreateFolder,
  onRenameFolder,
  onDeleteClick,
  folders
}) => {
  const hasChildren = folders.some(f => f.parent_id === folder.id);
  const isExpanded = expandedFolders.has(folder.id);
  const childFolders = folders.filter(f => f.parent_id === folder.id);
  const isSelected = selectedFolder?.id === folder.id;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className={`
          flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer group
          transition-all duration-200 relative
          ${isSelected ? 'bg-[#f15922] text-white' : 'hover:bg-gray-100'}
        `}
        style={{ paddingLeft: `${(level + 1) * 12}px` }}
      >
        <button
          onClick={() => hasChildren && onToggle(folder.id)}
          className={`
            p-0.5 rounded transition-transform duration-200
            ${hasChildren ? 'visible' : 'invisible'}
            ${isSelected ? 'text-white' : 'text-gray-400 hover:text-gray-600'}
          `}
        >
          <ChevronRight
            size={16}
            className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          />
        </button>

        <div
          className="flex-1 flex items-center justify-between min-w-0 cursor-pointer"
          onClick={() => onSelect(folder)}
        >
          <span className="truncate">{folder.name}</span>
          
          <div className={`
            opacity-0 group-hover:opacity-100 flex items-center gap-1
            transition-opacity duration-200
            ${isSelected ? 'text-white' : 'text-gray-500'}
          `}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateFolder(folder.id);
              }}
              className="p-1 hover:bg-black/10 rounded"
              title="Nouveau sous-dossier"
            >
              <FolderPlus size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRenameFolder(folder);
              }}
              className="p-1 hover:bg-black/10 rounded"
              title="Renommer"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteClick(folder);
              }}
              className="p-1 hover:bg-black/10 rounded"
              title="Supprimer"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && childFolders.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {childFolders.map(childFolder => (
              <FolderTreeItem
                key={childFolder.id}
                folder={childFolder}
                level={level + 1}
                selectedFolder={selectedFolder}
                expandedFolders={expandedFolders}
                onSelect={onSelect}
                onToggle={onToggle}
                onCreateFolder={onCreateFolder}
                onRenameFolder={onRenameFolder}
                onDeleteClick={onDeleteClick}
                folders={folders}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

interface DocumentImportModalProps extends ModalProps {
  // Additional props if needed
}

export function DocumentImportModal() {
  const [selectedPath, setSelectedPath] = useState<Folder[]>([]);
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [processingStatus, setProcessingStatus] = useState<ProcessingProgress>({
    isProcessing: false,
    progress: 0,
    stage: 'preparation',
    message: ''
  });
  
  const [folderModal, setFolderModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'rename';
    parentId: string | null;
    folder?: Folder;
  }>({
    isOpen: false,
    mode: 'create',
    parentId: null
  });

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    folder: Folder | null;
    isDeleting: boolean;
  }>({
    isOpen: false,
    folder: null,
    isDeleting: false
  });

  const {
    isModalOpen,
    folders,
    currentFolder,
    loading,
    error,
    setModalOpen,
    createFolder,
    uploadDocument,
    fetchFolders,
    setCurrentFolder,
    deleteFolder,
    renameFolder,
    clearError,
  } = useDocumentStore();

  useEffect(() => {
    if (isModalOpen) {
      fetchFolders();

      const pendingImport = localStorage.getItem('pendingReportImport');
      if (pendingImport) {
        try {
          const importData = JSON.parse(pendingImport);
          const file = new File([importData.content], importData.name, {
            type: importData.type
          });
          setSelectedFile(file);
          setDescription('Rapport généré automatiquement');
          localStorage.removeItem('pendingReportImport');
        } catch (error) {
          console.error('Error processing pending import:', error);
          localStorage.removeItem('pendingReportImport');
        }
      } else if (!processingStatus.isProcessing) {
        setProcessingStatus({
          isProcessing: false,
          progress: 0,
          stage: 'preparation',
          message: ''
        });
        setSelectedFile(null);
        setDescription('');
      }
    }
  }, [isModalOpen, fetchFolders, processingStatus.isProcessing]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0 && !processingStatus.isProcessing) {
      const file = acceptedFiles[0];
      setSelectedFile(file);
      
      setProcessingStatus({
        isProcessing: false,
        progress: 0,
        stage: 'preparation',
        message: ''
      });
    }
  }, [processingStatus.isProcessing]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/json': ['.json'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'audio/mpeg': ['.mp3'],
      'audio/wav': ['.wav'],
      'audio/wave': ['.wav'],
      'audio/x-wav': ['.wav'],
      'audio/aac': ['.aac'],
      'audio/ogg': ['.ogg'],
      'audio/webm': ['.webm'],
      'text/html': ['.html'],
      'video/mp4': ['.mp4']
    },
    multiple: false,
    disabled: processingStatus.isProcessing
  });

  const handleFolderSelect = (folder: Folder) => {
    setCurrentFolder(folder);
    
    // Build the path to this folder
    const path: Folder[] = [];
    let currentId = folder.id;
    
    while (currentId) {
      const currentFolder = folders.find(f => f.id === currentId);
      if (currentFolder) {
        path.unshift(currentFolder);
        currentId = currentFolder.parent_id;
      } else {
        break;
      }
    }
    
    setSelectedPath(path);
    
    // Expand all parent folders
    const newExpanded = new Set(expandedFolders);
    path.forEach(f => newExpanded.add(f.id));
    setExpandedFolders(newExpanded);
  };

  const handleToggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleCreateFolder = (parentId: string | null) => {
    setFolderModal({
      isOpen: true,
      mode: 'create',
      parentId
    });
  };

  const handleRenameFolder = (folder: Folder) => {
    setFolderModal({
      isOpen: true,
      mode: 'rename',
      parentId: folder.parent_id,
      folder
    });
  };

  const handleDeleteClick = (folder: Folder) => {
    setDeleteConfirmation({
      isOpen: true,
      folder,
      isDeleting: false
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation.folder) return;
    
    try {
      setDeleteConfirmation(prev => ({ ...prev, isDeleting: true }));
      await deleteFolder(deleteConfirmation.folder.id);
      await fetchFolders();
      
      if (currentFolder?.id === deleteConfirmation.folder.id) {
        setCurrentFolder(null);
        setExpandedFolders(new Set());
        setSelectedPath([]);
      }
      
      setDeleteConfirmation({ isOpen: false, folder: null, isDeleting: false });
    } catch (error) {
      console.error('Error deleting folder:', error);
      setDeleteConfirmation(prev => ({ ...prev, isDeleting: false }));
    }
  };

  const handleFolderSubmit = async (name: string) => {
    try {
      if (folderModal.mode === 'create') {
        await createFolder(name, folderModal.parentId);
      } else if (folderModal.folder) {
        await renameFolder(folderModal.folder.id, name);
      }
      await fetchFolders();
      
      // Expand the parent folder if it exists
      if (folderModal.parentId) {
        setExpandedFolders(new Set(expandedFolders).add(folderModal.parentId));
      }
      
      setFolderModal({ isOpen: false, mode: 'create', parentId: null });
    } catch (error) {
      console.error('Error handling folder:', error);
      throw error;
    }
  };

  const handleUpload = async () => {
    if (!currentFolder || !selectedFile || processingStatus.isProcessing) return;

    try {
      // Validate file size
      const validation = validateFileSize(selectedFile);
      if (!validation.valid) {
        throw new Error(validation.message);
      }

      setProcessingStatus({
        isProcessing: true,
        progress: 0,
        stage: 'preparation',
        message: 'Préparation du document...'
      });

      const sanitizedDescription = description
        .replace(/[^a-zA-Z0-9\s]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

      // For audio/video files, store the original file
      if (selectedFile.type.startsWith('audio/') || selectedFile.type.startsWith('video/')) {
        const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || '';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `documents/${fileName}`;

        // Upload in chunks for large files
        const chunkSize = 5 * 1024 * 1024; // 5MB chunks
        const totalChunks = Math.ceil(selectedFile.size / chunkSize);
        let uploadedChunks = 0;

        // Create upload options with metadata
        const uploadOptions = {
          cacheControl: '3600',
          contentType: selectedFile.type,
          duplex: 'half',
          metadata: {
            size: selectedFile.size.toString(),
            mimetype: selectedFile.type,
            originalName: selectedFile.name
          }
        };

        // Handle large file upload
        if (selectedFile.size > chunkSize) {
          const chunks: Blob[] = [];
          let offset = 0;

          while (offset < selectedFile.size) {
            chunks.push(selectedFile.slice(offset, offset + chunkSize));
            offset += chunkSize;
          }

          // Upload chunks sequentially
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const isLastChunk = i === chunks.length - 1;
            const range = `bytes ${i * chunkSize}-${Math.min((i + 1) * chunkSize - 1, selectedFile.size - 1)}/${selectedFile.size}`;

            const { error: uploadError } = await supabase.storage
              .from('documents')
              .upload(filePath, chunk, {
                ...uploadOptions,
                upsert: true,
                ...(isLastChunk ? {} : { duplex: 'half' }),
                headers: {
                  'Content-Range': range,
                  'x-upsert': 'true'
                }
              });

            if (uploadError) throw uploadError;
            
            uploadedChunks++;
            setProcessingStatus({
              isProcessing: true,
              progress: Math.round((uploadedChunks / totalChunks) * 100),
              stage: 'upload',
              message: `Téléversement en cours (${uploadedChunks}/${totalChunks})...`
            });
          }
        } else {
          // Small file upload
          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, selectedFile, uploadOptions);

          if (uploadError) throw uploadError;
        }

        // Create document record
        await uploadDocument(selectedFile, currentFolder.id, {
          type: selectedFile.type.startsWith('audio/') ? 'audio' : 'video',
          description: sanitizedDescription,
          processed: true,
          size: selectedFile.size,
          url: filePath
        });

        setProcessingStatus({
          isProcessing: false,
          progress: 100,
          stage: 'complete',
          message: 'Document traité avec succès !'
        });

        setTimeout(() => {
          setSelectedFile(null);
          setDescription('');
          setModalOpen(false);
        }, 2000);

        return;
      }

      // For other document types, process normally
      const result = await processDocument(selectedFile, {
        openaiApiKey: config.openai.apiKey,
        onProgress: (progress) => {
          setProcessingStatus(progress);
        }
      });

      if (!result) {
        throw new Error('Échec du traitement du document');
      }

      // Create document record
      await uploadDocument(selectedFile, currentFolder.id, {
        type: selectedFile.type,
        description: sanitizedDescription,
        processed: true,
        size: selectedFile.size
      });

      setProcessingStatus({
        isProcessing: false,
        progress: 100,
        stage: 'complete',
        message: 'Document traité avec succès !'
      });

      setTimeout(() => {
        setSelectedFile(null);
        setDescription('');
        setModalOpen(false);
      }, 2000);

    } catch (error) {
      console.error('Overall error:', error);
      await logError(error instanceof Error ? error : new Error(String(error)));
      setProcessingStatus({
        isProcessing: false,
        progress: 0,
        stage: 'preparation',
        message: error instanceof Error ? error.message : 'Une erreur est survenue'
      });
      setSelectedFile(null);
    }
  };

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl mx-4">
        <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-xl font-medium text-white flex items-center gap-2">
            <FileText size={24} />
            Importer un document
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => !processingStatus.isProcessing && setModalOpen(false)}
              className="text-white hover:text-white/90"
              disabled={processingStatus.isProcessing}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 p-6">
          {/* Upload section - 25% */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Téléverser un document</h3>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-[#f15922] bg-[#f15922]/5'
                  : processingStatus.isProcessing
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                  : 'border-gray-300 hover:border-[#f15922] hover:bg-gray-50'
              }`}
            >
              <input {...getInputProps()} disabled={processingStatus.isProcessing} />
              <div className="flex flex-col items-center justify-center">
                {selectedFile ? (
                  <FileIcon file={selectedFile} size={48} />
                ) : (
                  <FileText
                    size={48}
                    className={`mx-auto mb-4 ${
                      isDragActive ? 'text-[#f15922]' : 'text-gray-400'
                    }`}
                  />
                )}
                <p className="text-lg font-medium text-gray-900 mb-2">
                  {selectedFile ? selectedFile.name : 'Déposez votre fichier ici'}
                </p>
                <p className="text-gray-500">ou</p>
                <button 
                  className={`mt-2 px-4 py-2 ${
                    processingStatus.isProcessing
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-[#f15922] hover:bg-[#f15922]/90'
                  } text-white rounded-md transition-colors`}
                  disabled={processingStatus.isProcessing}
                >
                  Parcourir
                </button>
              </div>
            </div>
          </div>

          {/* IRSST section - 50% */}
          <div className="col-span-2 space-y-4">
            <h3 className="text-lg font-medium text-gray-900">IRSST</h3>
            
            {/* Folder path breadcrumb */}
            {selectedPath.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-2 mb-2 flex items-center gap-1 text-sm">
                <span className="text-gray-600">Dossier sélectionné :</span>
                <div className="flex items-center gap-1 overflow-x-auto">
                  {selectedPath.map((folder, index) => (
                    <React.Fragment key={folder.id}>
                      {index > 0 && (
                        <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                      )}
                      <button
                        onClick={() => handleFolderSelect(folder)}
                        className={`whitespace-nowrap ${
                          index === selectedPath.length - 1
                            ? 'text-gray-900 font-medium'
                            : 'text-[#f15922] hover:underline'
                        }`}
                      >
                        {folder.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden shadow-sm bg-white">
              <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <span className="font-medium text-sm text-gray-700">
                  Structure des dossiers
                </span>
                <button
                  onClick={() => handleCreateFolder(currentFolder?.id ?? null)}
                  className="p-1.5 text-[#f15922] hover:bg-[#f15922]/10 rounded-full transition-colors"
                  title={currentFolder ? "Nouveau sous-dossier" : "Nouveau dossier racine"}
                >
                  <FolderPlus size={16} />
                </button>
              </div>

              <div className="h-[400px] overflow-y-auto p-2">
                <AnimatePresence mode="popLayout">
                  {folders
                    .filter(f => !f.parent_id)
                    .map(folder => (
                      <FolderTreeItem
                        key={folder.id}
                        folder={folder}
                        level={0}
                        selectedFolder={currentFolder}
                        expandedFolders={expandedFolders}
                        onSelect={handleFolderSelect}
                        onToggle={handleToggleFolder}
                        onCreateFolder={handleCreateFolder}
                        onRenameFolder={handleRenameFolder}
                        onDeleteClick={handleDeleteClick}
                        folders={folders}
                      />
                    ))}
                </AnimatePresence>

                {folders.filter(f => !f.parent_id).length === 0 && (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    Aucun dossier
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Indexation section - 25% */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Indexation du document</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez le document pour améliorer la recherche"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent resize-none"
                  rows={4}
                  disabled={processingStatus.isProcessing}
                />
              </div>

              <button
                onClick={handleUpload}
                disabled={!selectedFile || !currentFolder || processingStatus.isProcessing}
                className={`w-full mt-6 px-4 py-2 rounded-md flex items-center justify-center gap-2 ${
                  !selectedFile || !currentFolder || processingStatus.isProcessing
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-[#f15922] text-white hover:bg-[#f15922]/90'
                }`}
              >
                {processingStatus.isProcessing ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    {processingStatus.stage === 'preparation' ? 'Préparation en cours...' : 'Traitement en cours...'}
                  </>
                ) : (
                  <>
                    <FileText size={20} />
                    Téléverser le document
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {processingStatus.isProcessing && (
          <div className="px-6 pb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">
                {processingStatus.message}
              </p>
              <div className="flex items-center gap-4">
                <p className="text-sm font-medium text-gray-700">
                  {Math.round(processingStatus.progress)}%
                </p>
              </div>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#f15922]"
                initial={{ width: 0 }}
                animate={{ width: `${processingStatus.progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="px-6 pb-6">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          </div>
        )}
      </div>
      
      <FolderModal
        isOpen={folderModal.isOpen}
        onClose={() => setFolderModal({ isOpen: false, mode: 'create', parentId: null })}
        onSubmit={handleFolderSubmit}
        title={folderModal.mode === 'create' ? 'Nouveau dossier' : 'Renommer le dossier'}
        initialValue={folderModal.folder?.name}
        mode={folderModal.mode}
        parentFolder={
          folderModal.parentId
            ? folders.find(f => f.id === folderModal.parentId)?.name
            : undefined
        }
      />

      <DeleteConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        title="Supprimer le dossier"
        message={`Êtes-vous sûr de vouloir supprimer le dossier "${deleteConfirmation.folder?.name}" ? Cette action est irréversible et supprimera également tous les sous-dossiers et documents qu'il contient.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmation({ isOpen: false, folder: null, isDeleting: false })}
        isDeleting={deleteConfirmation.isDeleting}
      />
    </div>
  );
}