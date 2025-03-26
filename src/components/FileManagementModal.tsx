import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, AlertTriangle, ChevronRight, FileText, Search, Filter, Download, Calendar, FolderPlus, Edit2 } from 'lucide-react';
import { useDocumentStore, Document, Folder } from '../lib/documentStore';
import { supabase } from '../lib/supabase';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { FileIcon } from './FileIcon';

interface FileManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
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

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function FileManagementModal({ isOpen, onClose }: FileManagementModalProps) {
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    type: 'all',
    dateRange: 'all' as 'all' | 'today' | 'week' | 'month'
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    document: Document | null;
  }>({
    isOpen: false,
    document: null
  });

  const {
    folders,
    documents,
    loading,
    error,
    fetchFolders,
    fetchAllDocuments,
    createFolder,
    deleteFolder,
    renameFolder,
    setError,
    clearError
  } = useDocumentStore();

  useEffect(() => {
    if (isOpen) {
      fetchFolders();
      fetchAllDocuments();
    }
  }, [isOpen, fetchFolders, fetchAllDocuments]);

  const documentCounts = folders.reduce((acc, folder) => {
    acc[folder.id] = documents.filter(doc => doc.folder_id === folder.id).length;
    return acc;
  }, {} as Record<string, number>);

  const handleFolderSelect = (folder: Folder) => {
    setSelectedFolder(folder);
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
      if (selectedFolder?.id === folder.id) {
        setSelectedFolder(null);
      }
    }
  };

  const handleDownload = async (documentFile: Document) => {
    try {
      // For audio files, get the transcription content and format it
      if (documentFile.type === 'audio') {
        const { data: contentData, error: contentError } = await supabase
          .from('document_contents')
          .select('content')
          .eq('document_id', documentFile.id)
          .single();

        if (contentError) throw contentError;
        if (!contentData?.content) throw new Error('No transcription found');

        // Parse the JSON content
        const transcriptionData = JSON.parse(contentData.content);
        
        // Format the transcription with timestamps and metadata
        const formattedContent = `
TRANSCRIPTION AUDIO
==================

Fichier: ${transcriptionData.metadata.fileName}
Date de traitement: ${new Date(transcriptionData.processingDate).toLocaleString('fr-FR')}
Durée: ${Math.floor(transcriptionData.metadata.duration / 60)}:${String(Math.floor(transcriptionData.metadata.duration % 60)).padStart(2, '0')}
Langue: ${transcriptionData.metadata.language === 'fra' ? 'Français' : 'Anglais'}

SEGMENTS
========

${transcriptionData.metadata.segments.map((segment: any) => {
  const startTime = new Date(segment.start * 1000).toISOString().substr(11, 8);
  const endTime = new Date(segment.end * 1000).toISOString().substr(11, 8);
  return `[${startTime} -> ${endTime}]\n${segment.text}\n`;
}).join('\n')}

TEXTE COMPLET
============

${transcriptionData.content}

---
Généré par RINGO
`.trim();

        // Create a text file with the formatted transcription
        const transcriptionBlob = new Blob([formattedContent], { 
          type: 'text/plain;charset=UTF-8' 
        });
        
        const url = URL.createObjectURL(transcriptionBlob);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = `${documentFile.name.replace(/\.[^/.]+$/, '')}_transcription.txt`;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }

      // For other files, download directly from storage
      const { data, error: downloadError } = await supabase.storage
        .from('documents')
        .download(documentFile.url);

      if (downloadError) throw downloadError;

      const link = window.document.createElement('a');
      const url = URL.createObjectURL(data);
      link.href = url;
      link.download = documentFile.name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      setError(error instanceof Error ? error.message : 'Erreur lors du téléchargement du fichier');
    }
  };

  const handleDelete = async (document: Document) => {
    setDeleteConfirmation({
      isOpen: true,
      document
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation.document) return;

    try {
      const { error: contentError } = await supabase
        .from('document_contents')
        .delete()
        .eq('document_id', deleteConfirmation.document.id);

      if (contentError) throw contentError;

      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([deleteConfirmation.document.url]);

      if (storageError) throw storageError;

      const { error: convLinksError } = await supabase
        .from('conversation_documents')
        .delete()
        .eq('document_id', deleteConfirmation.document.id);

      if (convLinksError) throw convLinksError;

      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', deleteConfirmation.document.id);

      if (dbError) throw dbError;

      await fetchAllDocuments();
    } catch (error) {
      console.error('Failed to delete document:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete document');
    } finally {
      setDeleteConfirmation({ isOpen: false, document: null });
    }
  };

  const filteredDocuments = documents.filter(doc => {
    if (selectedFolder && doc.folder_id !== selectedFolder.id) return false;
    
    if (filters.type !== 'all' && doc.type !== filters.type) return false;
    
    const docDate = new Date(doc.created_at);
    const now = new Date();
    switch (filters.dateRange) {
      case 'today':
        if (docDate.toDateString() !== now.toDateString()) return false;
        break;
      case 'week':
        const weekAgo = new Date(now.setDate(now.getDate() - 7));
        if (docDate < weekAgo) return false;
        break;
      case 'month':
        const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
        if (docDate < monthAgo) return false;
        break;
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        doc.name.toLowerCase().includes(query) ||
        doc.type.toLowerCase().includes(query) ||
        doc.description?.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl mx-4 h-[85vh] flex flex-col">
        <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-xl font-medium text-white flex items-center gap-2">
            <FileText size={24} />
            Gestion des Fichiers
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-white/90"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/4 border-r p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">IRSST</h3>
              <button
                onClick={() => handleCreateFolder(null)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#f15922] hover:bg-[#f15922]/5 rounded-lg transition-colors"
              >
                <FolderPlus size={16} />
                <span>Nouveau dossier</span>
              </button>
            </div>
            <div className="space-y-1">
              {folders
                .filter(f => !f.parent_id)
                .map(folder => (
                  <FolderTreeItem
                    key={folder.id}
                    folder={folder}
                    level={0}
                    selectedFolder={selectedFolder}
                    documentCounts={documentCounts}
                    onSelect={handleFolderSelect}
                    onCreateFolder={handleCreateFolder}
                    onRenameFolder={handleRenameFolder}
                    onDeleteFolder={handleDeleteFolder}
                  />
                ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rechercher
                  </label>
                  <div className="relative">
                    <Search 
                      size={18} 
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher un document..."
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <div className="relative">
                    <Filter 
                      size={18} 
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <select
                      value={filters.type}
                      onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                    >
                      <option value="all">Tous les types</option>
                      <option value="pdf">PDF</option>
                      <option value="doc">Word</option>
                      <option value="data">Données</option>
                      <option value="audio">Audio</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Période
                  </label>
                  <div className="relative">
                    <Calendar 
                      size={18} 
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <select
                      value={filters.dateRange}
                      onChange={(e) => setFilters(f => ({ ...f, dateRange: e.target.value as typeof filters.dateRange }))}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                    >
                      <option value="all">Toutes les dates</option>
                      <option value="today">Aujourd'hui</option>
                      <option value="week">Cette semaine</option>
                      <option value="month">Ce mois</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f15922]"></div>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <FileText size={48} className="text-gray-400 mb-4" />
                  <p className="text-lg font-medium">Aucun document trouvé</p>
                  <p className="text-sm">Modifiez vos filtres ou sélectionnez un autre dossier</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDocuments.map((doc) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="bg-white rounded-lg border shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="text-[#f15922] flex-shrink-0">
                            <FileIcon type={doc.type} size={24} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">
                              {doc.name}
                            </h4>
                            {doc.description && (
                              <p className="text-sm text-gray-500 truncate mt-1">
                                {doc.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                              <span>{formatDate(doc.created_at)}</span>
                              <span>•</span>
                              <span>{formatFileSize(doc.size)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-4">
                          <button
                            onClick={() => handleDownload(doc)}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Télécharger"
                          >
                            <Download size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(doc)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        title="Supprimer définitivement le fichier"
        message={`Êtes-vous sûr de vouloir supprimer définitivement le fichier "${deleteConfirmation.document?.name}" ? Cette action est irréversible et supprimera également toutes les références à ce document dans les conversations.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmation({ isOpen: false, document: null })}
      />
    </div>
  );
}