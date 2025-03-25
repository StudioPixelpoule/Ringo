import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe, FolderPlus, ChevronRight, Edit2, Trash2, Send, Loader2 } from 'lucide-react';
import { useDocumentStore, Folder } from '../lib/documentStore';
import { extractWebContent } from '../lib/webContentExtractor';
import { FolderModal } from './FolderModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { logError } from '../lib/errorLogger';

interface ProcessingStatus {
  isProcessing: boolean;
  progress: number;
  stage: 'preparation' | 'processing' | 'extraction' | 'complete';
  message: string;
}

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

export function WebContentImporter({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void;
}) {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPath, setSelectedPath] = useState<Folder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
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
    folders,
    currentFolder,
    loading,
    error,
    fetchFolders,
    setCurrentFolder,
    createFolder,
    deleteFolder,
    renameFolder,
    uploadDocument,
    setError,
    clearError,
  } = useDocumentStore();

  useEffect(() => {
    if (isOpen) {
      fetchFolders();
      clearError();
    }
  }, [isOpen, fetchFolders, clearError]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !currentFolder || processingStatus.isProcessing) return;

    try {
      setProcessingStatus({
        isProcessing: true,
        progress: 10,
        message: 'Récupération du contenu web...',
        stage: 'preparation'
      });

      // Extract web content with fallback strategies
      const result = await extractWebContent(url, {
        onProgress: (progress) => {
          setProcessingStatus({
            isProcessing: true,
            progress: progress.progress,
            stage: progress.stage,
            message: progress.message
          });
        },
        signal: new AbortController().signal
      });

      setProcessingStatus({
        isProcessing: true,
        progress: 70,
        stage: 'processing',
        message: 'Création du document...'
      });

      // Create HTML file with extracted content
      const formattedContent = `
<!DOCTYPE html>
<html lang="${result.metadata.language || 'fr'}">
<head>
  <meta charset="UTF-8">
  <title>${result.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
      color: #333;
    }
    h1 { color: #f15922; }
    h2 { color: #dba747; }
    a { color: #106f69; }
    pre {
      background: #f6f8fa;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
    }
    blockquote {
      border-left: 4px solid #dba747;
      margin: 0;
      padding-left: 16px;
      color: #666;
    }
    .metadata {
      background: #f8f9fa;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 1em 0;
    }
  </style>
</head>
<body>
  <div class="metadata">
    <h2>Métadonnées</h2>
    <p><strong>Source:</strong> <a href="${result.metadata.url}">${result.metadata.url}</a></p>
    <p><strong>Date d'extraction:</strong> ${new Date(result.metadata.timestamp).toLocaleString('fr-FR')}</p>
    <p><strong>Nombre de mots:</strong> ${result.metadata.wordCount}</p>
    ${result.metadata.hasImages ? '<p><strong>Contient des images:</strong> Oui</p>' : ''}
  </div>
  ${result.content}
</body>
</html>`;

      // Create file object
      const file = new File(
        [formattedContent],
        `web-${new URL(url).hostname}-${Date.now()}.html`,
        { type: 'text/html' }
      );

      setProcessingStatus({
        isProcessing: true,
        progress: 90,
        stage: 'extraction',
        message: 'Enregistrement du document...'
      });

      // Upload using existing document store
      await uploadDocument(file, currentFolder.id, {
        type: 'web',
        description: description || url,
        processed: true,
        size: file.size
      });

      setProcessingStatus({
        isProcessing: false,
        progress: 100,
        stage: 'complete',
        message: 'Importation terminée'
      });

      // Reset form
      setUrl('');
      setDescription('');
      
      // Close modal after delay
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (error) {
      logError(error, {
        component: 'WebContentImporter',
        action: 'handleSubmit',
        url,
        folderPath: getFolderPath(folders, currentFolder.id)
      });

      setProcessingStatus({
        isProcessing: false,
        progress: 0,
        stage: 'preparation',
        message: error instanceof Error ? error.message : 'Une erreur est survenue'
      });
      setError(error instanceof Error ? error.message : 'Une erreur est survenue');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl w-[90vw] h-[80vh] flex flex-col overflow-hidden"
      >
        <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-medium text-white flex items-center gap-2">
            <Globe size={24} />
            Importer du Contenu Web
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-white/90"
            disabled={processingStatus.isProcessing}
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left column - URL input - 25% */}
          <div className="w-1/4 border-r p-4 space-y-4">
            <h3 className="text-lg font-medium text-gray-900">URL du site web</h3>
            <div className="relative">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                required
                disabled={processingStatus.isProcessing}
              />
              <Globe 
                size={18} 
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" 
              />
            </div>
          </div>

          {/* Middle column - Folder structure - 50% */}
          <div className="w-1/2 border-r p-4 space-y-4">
            <h3 className="text-lg font-medium text-gray-900">IRSST</h3>
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

          {/* Right column - Indexation - 25% */}
          <div className="w-1/4 p-4 space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Indexation du site</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez le contenu pour améliorer la recherche"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent resize-none"
                  rows={4}
                  disabled={processingStatus.isProcessing}
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={!url || !currentFolder || processingStatus.isProcessing}
                className={`w-full mt-6 px-4 py-2 rounded-md flex items-center justify-center gap-2 ${
                  !url || !currentFolder || processingStatus.isProcessing
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
                    <Send size={20} />
                    Importer le site
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
              <div
                className="h-full bg-[#f15922] transition-all duration-300"
                style={{ width: `${processingStatus.progress}%` }}
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
      </motion.div>

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