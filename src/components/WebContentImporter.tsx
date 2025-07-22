import React, { useState, useEffect } from 'react';
import { X, Globe, FolderPlus, ChevronRight, Edit2, Trash2, Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDocumentStore, Folder } from '../lib/documentStore';
import { supabase } from '../lib/supabase';

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
  documentCounts: Record<string, number>;
  onSelect: (folder: Folder) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
}

const FolderTreeItem: React.FC<FolderTreeItemProps> = ({
  folder,
  level,
  selectedFolder,
  documentCounts,
  onSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder
}) => {
  const [isOpen, setIsOpen] = useState(level === 0);
  const { folders } = useDocumentStore();
  const hasChildren = folders.some(f => f.parent_id === folder.id);
  const count = documentCounts[folder.id] || 0;

  const getTotalCount = (folderId: string): number => {
    const directCount = documentCounts[folderId] || 0;
    const childFolders = folders.filter(f => f.parent_id === folderId);
    const childCount = childFolders.reduce((sum, child) => sum + getTotalCount(child.id), 0);
    return directCount + childCount;
  };

  const totalCount = getTotalCount(folder.id);

  return (
    <div className="select-none">
      <motion.div
        className={`
          flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer group text-sm
          ${selectedFolder?.id === folder.id 
            ? 'bg-[#f15922] text-white' 
            : 'text-gray-700 hover:bg-[#f15922]/5 hover:text-[#f15922]'
          }
          ${level === 0 ? 'mb-0.5' : ''}
        `}
        onClick={() => onSelect(folder)}
        style={{ marginLeft: `${level * 8}px` }}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {hasChildren && (
            <motion.button
              initial={false}
              animate={{ rotate: isOpen ? 90 : 0 }}
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
              }}
              className={`
                p-0.5 rounded transition-colors
                ${selectedFolder?.id === folder.id 
                  ? 'hover:bg-white/20 text-white' 
                  : 'text-[#dba747] hover:bg-[#dba747]/10'
                }
              `}
            >
              <ChevronRight size={14} />
            </motion.button>
          )}
          <span className="truncate text-xs">{folder.name}</span>
        </div>
        
        {totalCount > 0 && (
          <div className={`
            flex items-center gap-1 text-xs
            ${selectedFolder?.id === folder.id 
              ? 'bg-white/20 text-white' 
              : level === 0 
                ? 'bg-[#dba747]/10 text-[#dba747]' 
                : 'bg-gray-100 text-gray-500'
            }
            px-1.5 py-0.5 rounded-full font-medium transition-colors
          `}>
            {count > 0 && (
              <span className={
                selectedFolder?.id === folder.id 
                  ? 'text-white' 
                  : level === 0 
                    ? 'text-[#dba747]' 
                    : ''
              }>
                {count}
              </span>
            )}
            {count > 0 && totalCount > count && ' + '}
            {totalCount > count && (
              <span className={
                selectedFolder?.id === folder.id 
                  ? 'text-white/70' 
                  : 'text-gray-400'
              }>
                {totalCount - count}
              </span>
            )}
          </div>
        )}

        <div className={`
          flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity
          ${selectedFolder?.id === folder.id ? 'text-white' : 'text-gray-500'}
        `}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateFolder(folder.id);
            }}
            className="p-1 hover:bg-black/10 rounded"
          >
            <FolderPlus size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRenameFolder(folder);
            }}
            className="p-1 hover:bg-black/10 rounded"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteFolder(folder);
            }}
            className="p-1 hover:bg-black/10 rounded"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {isOpen && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {folders
              .filter(f => f.parent_id === folder.id)
              .map(childFolder => (
                <FolderTreeItem
                  key={childFolder.id}
                  folder={childFolder}
                  level={level + 1}
                  selectedFolder={selectedFolder}
                  documentCounts={documentCounts}
                  onSelect={onSelect}
                  onCreateFolder={onCreateFolder}
                  onRenameFolder={onRenameFolder}
                  onDeleteFolder={onDeleteFolder}
                />
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    progress: 0,
    stage: 'preparation',
    message: ''
  });

  const {
    folders,
    currentFolder,
    loading,
    error,
    uploadDocument,
    fetchFolders,
    setCurrentFolder,
    createFolder,
    deleteFolder,
    renameFolder,
    clearError,
    setError
  } = useDocumentStore();

  useEffect(() => {
    if (isOpen) {
      fetchFolders();
    }
  }, [isOpen, fetchFolders]);

  // Calculate document counts for each folder
  const documentCounts = folders.reduce((acc, folder) => {
    acc[folder.id] = 0; // Web content doesn't affect document counts
    return acc;
  }, {} as Record<string, number>);

  const handleFolderSelect = (folder: Folder) => {
    setCurrentFolder(folder);
  };

  const handleCreateFolder = async (parentId: string | null) => {
    const name = window.prompt('Nom du dossier:');
    if (name) {
      await createFolder(name, parentId);
      await fetchFolders();
    }
  };

  const handleRenameFolder = async (folder: Folder) => {
    const newName = window.prompt('Nouveau nom:', folder.name);
    if (newName && newName !== folder.name) {
      await renameFolder(folder.id, newName);
      await fetchFolders();
    }
  };

  const handleDeleteFolder = async (folder: Folder) => {
    if (window.confirm(`Supprimer le dossier "${folder.name}" ?`)) {
      await deleteFolder(folder.id);
      await fetchFolders();
      if (currentFolder?.id === folder.id) {
        setCurrentFolder(null);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !currentFolder || processingStatus.isProcessing) return;

    try {
      setProcessingStatus({
        isProcessing: true,
        progress: 10,
        stage: 'preparation',
        message: 'Récupération du contenu web...'
      });

      // Use a more reliable CORS proxy
      const proxyUrl = 'https://api.allorigins.win/raw?url=';
      
      // Add error handling for URL
      let targetUrl;
      try {
        targetUrl = new URL(url);
        if (!['http:', 'https:'].includes(targetUrl.protocol)) {
          throw new Error('URL invalide: le protocole doit être HTTP ou HTTPS');
        }
      } catch (error) {
        throw new Error('URL invalide: veuillez entrer une URL valide');
      }

      // Fetch with timeout and retry
      const fetchWithTimeout = async (url: string, timeout = 10000) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      };

      const fetchWithRetry = async (url: string, retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            const response = await fetchWithTimeout(proxyUrl + encodeURIComponent(url));
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response;
          } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          }
        }
        throw new Error('Failed to fetch after retries');
      };

      const webpageResponse = await fetchWithRetry(targetUrl.href);
      const htmlContent = await webpageResponse.text();

      if (!htmlContent.trim()) {
        throw new Error('Le contenu de la page est vide');
      }

      setProcessingStatus({
        isProcessing: true,
        progress: 30,
        stage: 'processing',
        message: 'Extraction du contenu...'
      });

      // Use Supabase Edge Function for secure processing
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Non authentifié');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-web-content`,
        {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
            url: targetUrl.href,
            htmlContent: htmlContent.substring(0, 50000), // Limite à 50k caractères
            description: description
        })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process web content');
      }

      const data = await response.json();
      const extractedContent = data.content;

      if (!extractedContent) {
        throw new Error('No content extracted');
      }

      setProcessingStatus({
        isProcessing: true,
        progress: 70,
        stage: 'processing',
        message: 'Création du document...'
      });

      // Create HTML file with extracted content
      const formattedContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Web Content - ${url}</title>
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
  </style>
</head>
<body>
  <div class="metadata">
    <h2>Métadonnées</h2>
    <p><strong>Source:</strong> ${url}</p>
    <p><strong>Date d'extraction:</strong> ${new Date().toLocaleString('fr-FR')}</p>
  </div>
  ${extractedContent}
</body>
</html>`;

      // Create file object
      const file = new File(
        [formattedContent], 
        `web-content-${targetUrl.hostname}-${Date.now()}.html`, 
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
      console.error('Error importing web content:', error);
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

        <div className="grid grid-cols-4 gap-6 p-6">
          {/* Left column - URL input (25%) */}
          <div className="space-y-4">
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

          {/* Middle column - Folder structure (50%) */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">IRSST</h3>
              <button
                onClick={() => handleCreateFolder(null)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#f15922] hover:bg-[#f15922]/5 rounded-lg transition-colors"
              >
                <FolderPlus size={16} />
                <span>Nouveau dossier</span>
              </button>
            </div>
            <div className="border rounded-lg p-4 h-[400px] overflow-y-auto">
              {folders
                .filter(f => !f.parent_id)
                .map(folder => (
                  <FolderTreeItem
                    key={folder.id}
                    folder={folder}
                    level={0}
                    selectedFolder={currentFolder}
                    documentCounts={documentCounts}
                    onSelect={handleFolderSelect}
                    onCreateFolder={handleCreateFolder}
                    onRenameFolder={handleRenameFolder}
                    onDeleteFolder={handleDeleteFolder}
                  />
                ))}
            </div>
          </div>

          {/* Right column - Indexation (25%) */}
          <div className="space-y-4">
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
    </div>
  );
}