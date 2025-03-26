import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, AlertTriangle, ChevronUp, ChevronDown, FileText, Search, Filter, Download, Calendar, FolderTree, Grid, List, SortAsc, SortDesc, Eye, Edit2, Info } from 'lucide-react';
import { useDocumentStore, Document } from '../lib/documentStore';
import { supabase } from '../lib/supabase';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { FileIcon } from './FileIcon';

interface FileManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FilterState {
  type: string;
  folder: string;
  dateRange: 'all' | 'today' | 'week' | 'month';
  searchQuery: string;
}

interface SortConfig {
  key: keyof Document;
  direction: 'asc' | 'desc';
}

type ViewMode = 'grid' | 'list';

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

function getFolderPath(folders: any[], folderId: string): string {
  const path: string[] = [];
  let currentFolder = folders.find(f => f.id === folderId);
  
  while (currentFolder) {
    path.unshift(currentFolder.name);
    currentFolder = folders.find(f => f.id === currentFolder.parent_id);
  }
  
  return path.length > 0 ? `/${path.join('/')}` : '/';
}

export function FileManagementModal({ isOpen, onClose }: FileManagementModalProps) {
  const { documents = [], folders = [], loading, error, fetchAllDocuments, fetchFolders, setError } = useDocumentStore();
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    document: Document | null;
  }>({
    isOpen: false,
    document: null
  });

  const [filters, setFilters] = useState<FilterState>({
    type: 'all',
    folder: 'all',
    dateRange: 'all',
    searchQuery: ''
  });

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'created_at',
    direction: 'desc'
  });

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAllDocuments();
      fetchFolders();
    }
  }, [isOpen, fetchAllDocuments, fetchFolders]);

  const handleSort = (key: keyof Document) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filterDocuments = (docs: Document[]) => {
    return docs.filter(doc => {
      // Type filter
      if (filters.type !== 'all' && doc.type !== filters.type) return false;
      
      // Folder filter
      if (filters.folder !== 'all' && doc.folder_id !== filters.folder) return false;
      
      // Date range filter
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
      
      // Search query
      if (filters.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();
        return (
          doc.name.toLowerCase().includes(searchLower) ||
          doc.type.toLowerCase().includes(searchLower) ||
          doc.description?.toLowerCase().includes(searchLower) ||
          getFolderPath(folders, doc.folder_id).toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    });
  };

  const sortedAndFilteredDocuments = filterDocuments([...documents]).sort((a, b) => {
    if (sortConfig.key === 'created_at' || sortConfig.key === 'updated_at') {
      return sortConfig.direction === 'asc'
        ? new Date(a[sortConfig.key]).getTime() - new Date(b[sortConfig.key]).getTime()
        : new Date(b[sortConfig.key]).getTime() - new Date(a[sortConfig.key]).getTime();
    }
    
    if (sortConfig.key === 'size') {
      const aSize = a.size || 0;
      const bSize = b.size || 0;
      return sortConfig.direction === 'asc' ? aSize - bSize : bSize - aSize;
    }
    
    const aValue = String(a[sortConfig.key]).toLowerCase();
    const bValue = String(b[sortConfig.key]).toLowerCase();
    
    return sortConfig.direction === 'asc'
      ? aValue.localeCompare(bValue)
      : bValue.localeCompare(aValue);
  });

  const uniqueTypes = Array.from(new Set(documents.map(doc => doc.type)));

  const handleDeleteClick = (document: Document) => {
    setDeleteConfirmation({
      isOpen: true,
      document
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation.document) return;

    try {
      // First, delete document content if it exists
      const { error: contentError } = await supabase
        .from('document_contents')
        .delete()
        .eq('document_id', deleteConfirmation.document.id);

      if (contentError) throw contentError;

      // Then, delete the file from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([deleteConfirmation.document.url]);

      if (storageError) throw storageError;

      // Delete any conversation links
      const { error: convLinksError } = await supabase
        .from('conversation_documents')
        .delete()
        .eq('document_id', deleteConfirmation.document.id);

      if (convLinksError) throw convLinksError;

      // Finally, delete the document record
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', deleteConfirmation.document.id);

      if (dbError) throw dbError;

      // Refresh documents list
      await fetchAllDocuments();
      setSelectedDocument(null);
    } catch (error) {
      console.error('Failed to delete document:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete document');
    } finally {
      setDeleteConfirmation({ isOpen: false, document: null });
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.url);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      setError('Erreur lors du téléchargement du fichier');
    }
  };

  const handleDocumentClick = (doc: Document) => {
    setSelectedDocument(selectedDocument?.id === doc.id ? null : doc);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-xl">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText size={24} />
            Gestion des Fichiers
          </h2>
          <button
            onClick={onClose}
            className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Main content */}
        <div className="p-6 flex-1 overflow-hidden flex flex-col">
          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
              <AlertTriangle size={20} />
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-700 hover:text-red-900"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Filters and view controls */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="flex flex-wrap gap-4">
              {/* Search */}
              <div className="flex-1 min-w-[300px]">
                <div className={`
                  relative transition-all duration-200
                  ${isSearchFocused ? 'ring-2 ring-[#f15922] rounded-lg' : ''}
                `}>
                  <Search 
                    size={18} 
                    className={`
                      absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200
                      ${isSearchFocused ? 'text-[#f15922]' : 'text-gray-400'}
                    `}
                  />
                  <input
                    type="text"
                    value={filters.searchQuery}
                    onChange={(e) => setFilters(f => ({ ...f, searchQuery: e.target.value }))}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    placeholder="Rechercher par nom, type, description..."
                    className={`
                      w-full pl-10 pr-4 py-2 border rounded-lg 
                      transition-all duration-200
                      ${isSearchFocused 
                        ? 'bg-white border-transparent' 
                        : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                      }
                    `}
                  />
                </div>
              </div>

              {/* Type filter */}
              <div className="w-48">
                <div className="relative">
                  <Filter 
                    size={18} 
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" 
                  />
                  <select
                    value={filters.type}
                    onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg appearance-none hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                  >
                    <option value="all">Tous les types</option>
                    {uniqueTypes.map(type => (
                      <option key={type} value={type}>{type.toUpperCase()}</option>
                    ))}
                  </select>
                  <ChevronDown 
                    size={18} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" 
                  />
                </div>
              </div>

              {/* Folder filter */}
              <div className="w-48">
                <div className="relative">
                  <FolderTree 
                    size={18} 
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" 
                  />
                  <select
                    value={filters.folder}
                    onChange={(e) => setFilters(f => ({ ...f, folder: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg appearance-none hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                  >
                    <option value="all">Tous les dossiers</option>
                    {folders.map(folder => (
                      <option key={folder.id} value={folder.id}>{folder.name}</option>
                    ))}
                  </select>
                  <ChevronDown 
                    size={18} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" 
                  />
                </div>
              </div>

              {/* Date filter */}
              <div className="w-48">
                <div className="relative">
                  <Calendar 
                    size={18} 
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" 
                  />
                  <select
                    value={filters.dateRange}
                    onChange={(e) => setFilters(f => ({ ...f, dateRange: e.target.value as FilterState['dateRange'] }))}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg appearance-none hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                  >
                    <option value="all">Toutes les dates</option>
                    <option value="today">Aujourd'hui</option>
                    <option value="week">Cette semaine</option>
                    <option value="month">Ce mois</option>
                  </select>
                  <ChevronDown 
                    size={18} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" 
                  />
                </div>
              </div>

              {/* View mode toggle */}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'grid' 
                      ? 'bg-[#f15922] text-white' 
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                  title="Vue grille"
                >
                  <Grid size={20} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-[#f15922] text-white' 
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                  title="Vue liste"
                >
                  <List size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Documents display */}
          <div className="flex-1 overflow-hidden">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f15922]"></div>
              </div>
            ) : sortedAndFilteredDocuments.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <FileText size={48} className="text-gray-400 mb-4" />
                <p className="text-lg font-medium">Aucun document trouvé</p>
                <p className="text-sm">Modifiez vos filtres ou importez de nouveaux documents</p>
              </div>
            ) : viewMode === 'grid' ? (
              // Grid view
              <div className="h-full overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-2">
                  {sortedAndFilteredDocuments.map((doc) => (
                    <motion.div
                      key={doc.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className={`
                        bg-white rounded-lg border shadow-sm overflow-hidden cursor-pointer
                        transition-all duration-200 hover:shadow-md
                        ${selectedDocument?.id === doc.id ? 'ring-2 ring-[#f15922]' : ''}
                      `}
                      onClick={() => handleDocumentClick(doc)}
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="text-[#f15922] flex-shrink-0">
                            <FileIcon type={doc.type} size={32} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 truncate">{doc.name}</h3>
                            {doc.description && (
                              <p className="text-sm text-gray-500 truncate mt-1">{doc.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                              <span className="px-2 py-1 bg-gray-100 rounded-full">
                                {doc.type.toUpperCase()}
                              </span>
                              <span>{formatFileSize(doc.size)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <AnimatePresence>
                        {selectedDocument?.id === doc.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t bg-gray-50"
                          >
                            <div className="p-3 flex items-center justify-between gap-2">
                              <div className="text-xs text-gray-500">
                                {formatDate(doc.created_at)}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(doc);
                                  }}
                                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                                  title="Télécharger"
                                >
                                  <Download size={16} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(doc);
                                  }}
                                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors"
                                  title="Supprimer"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              // List view
              <div className="h-full overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-6 py-3 text-left"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-1 cursor-pointer group">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Document</span>
                          {sortConfig.key === 'name' ? (
                            sortConfig.direction === 'asc' ? (
                              <SortAsc size={16} className="text-[#f15922]" />
                            ) : (
                              <SortDesc size={16} className="text-[#f15922]" />
                            )
                          ) : (
                            <SortAsc size={16} className="text-gray-400 opacity-0 group-hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left"
                        onClick={() => handleSort('type')}
                      >
                        <div className="flex items-center gap-1 cursor-pointer group">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Type</span>
                          {sortConfig.key === 'type' ? (
                            sortConfig.direction === 'asc' ? (
                              <SortAsc size={16} className="text-[#f15922]" />
                            ) : (
                              <SortDesc size={16} className="text-[#f15922]" />
                            )
                          ) : (
                            <SortAsc size={16} className="text-gray-400 opacity-0 group-hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Emplacement
                        </span>
                      </th>
                      <th 
                        className="px-6 py-3 text-left"
                        onClick={() => handleSort('created_at')}
                      >
                        <div className="flex items-center gap-1 cursor-pointer group">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Date</span>
                          {sortConfig.key === 'created_at' ? (
                            sortConfig.direction === 'asc' ? (
                              <SortAsc size={16} className="text-[#f15922]" />
                            ) : (
                              <SortDesc size={16} className="text-[#f15922]" />
                            )
                          ) : (
                            <SortAsc size={16} className="text-gray-400 opacity-0 group-hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left"
                        onClick={() => handleSort('size')}
                      >
                        <div className="flex items-center gap-1 cursor-pointer group">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Taille</span>
                          {sortConfig.key === 'size' ? (
                            sortConfig.direction === 'asc' ? (
                              <SortAsc size={16} className="text-[#f15922]" />
                            ) : (
                              <SortDesc size={16} className="text-[#f15922]" />
                            )
                          ) : (
                            <SortAsc size={16} className="text-gray-400 opacity-0 group-hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-right">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedAndFilteredDocuments.map((doc) => (
                      <tr 
                        key={doc.id} 
                        className={`
                          hover:bg-gray-50 transition-colors cursor-pointer
                          ${selectedDocument?.id === doc.id ? 'bg-[#f15922]/5' : ''}
                        `}
                        onClick={() => handleDocumentClick(doc)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <FileIcon type={doc.type} className="text-[#f15922] flex-shrink-0" size={24} />
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 truncate">{doc.name}</div>
                              {doc.description && (
                                <div className="text-sm text-gray-500 truncate">{doc.description}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                            {doc.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {getFolderPath(folders, doc.folder_id)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {formatDate(doc.created_at)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {formatFileSize(doc.size)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Preview functionality
                              }}
                              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Aperçu"
                            >
                              <Eye size={18} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(doc);
                              }}
                              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Télécharger"
                            >
                              <Download size={18} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Edit functionality
                              }}
                              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Modifier"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Info functionality
                              }}
                              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Informations"
                            >
                              <Info size={18} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(doc);
                              }}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              title="Supprimer définitivement"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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