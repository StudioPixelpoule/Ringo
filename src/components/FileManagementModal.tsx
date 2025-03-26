import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, AlertTriangle, ChevronUp, ChevronDown, FileText, Search, Filter, Download, Calendar, FolderTree } from 'lucide-react';
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

  const [sortConfig, setSortConfig] = useState<{
    key: keyof Document;
    direction: 'asc' | 'desc';
  }>({
    key: 'created_at',
    direction: 'desc'
  });

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
          getFolderPath(folders, doc.folder_id).toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    });
  };

  const sortedAndFilteredDocuments = filterDocuments([...documents]).sort((a, b) => {
    if (sortConfig.key === 'created_at') {
      return sortConfig.direction === 'asc'
        ? new Date(a[sortConfig.key]).getTime() - new Date(b[sortConfig.key]).getTime()
        : new Date(b[sortConfig.key]).getTime() - new Date(a[sortConfig.key]).getTime();
    }
    
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
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
    }
  };

  const SortIndicator = ({ columnKey }: { columnKey: keyof Document }) => {
    if (sortConfig.key !== columnKey) {
      return (
        <div className="w-4 h-4 opacity-30">
          <ChevronUp size={16} className="absolute" />
          <ChevronDown size={16} className="absolute" />
        </div>
      );
    }
    return sortConfig.direction === 'asc' ? (
      <ChevronUp size={16} className="text-[#f15922]" />
    ) : (
      <ChevronDown size={16} className="text-[#f15922]" />
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl mx-4 max-h-[85vh] flex flex-col">
        <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-xl">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText size={24} />
            Gestion des Fichiers
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
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

          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Search size={16} className="inline mr-1" />
                  Rechercher
                </label>
                <input
                  type="text"
                  value={filters.searchQuery}
                  onChange={(e) => setFilters(f => ({ ...f, searchQuery: e.target.value }))}
                  placeholder="Rechercher un document..."
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Filter size={16} className="inline mr-1" />
                  Type
                </label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                >
                  <option value="all">Tous les types</option>
                  {uniqueTypes.map(type => (
                    <option key={type} value={type}>{type.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FolderTree size={16} className="inline mr-1" />
                  Dossier
                </label>
                <select
                  value={filters.folder}
                  onChange={(e) => setFilters(f => ({ ...f, folder: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                >
                  <option value="all">Tous les dossiers</option>
                  {folders.map(folder => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar size={16} className="inline mr-1" />
                  Période
                </label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => setFilters(f => ({ ...f, dateRange: e.target.value as FilterState['dateRange'] }))}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                >
                  <option value="all">Toutes les dates</option>
                  <option value="today">Aujourd'hui</option>
                  <option value="week">Cette semaine</option>
                  <option value="month">Ce mois</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg overflow-hidden border">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5">
                    <button
                      onClick={() => handleSort('name')}
                      className="hover:text-gray-900 flex items-center gap-1 group"
                    >
                      <span>Document</span>
                      <div className="relative flex items-center">
                        <SortIndicator columnKey="name" />
                      </div>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('type')}
                      className="hover:text-gray-900 flex items-center gap-1 group"
                    >
                      <span>Type</span>
                      <div className="relative flex items-center">
                        <SortIndicator columnKey="type" />
                      </div>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Emplacement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('created_at')}
                      className="hover:text-gray-900 flex items-center gap-1 group"
                    >
                      <span>Date</span>
                      <div className="relative flex items-center">
                        <SortIndicator columnKey="created_at" />
                      </div>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Taille
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f15922]"></div>
                      </div>
                    </td>
                  </tr>
                ) : sortedAndFilteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      Aucun fichier trouvé
                    </td>
                  </tr>
                ) : (
                  sortedAndFilteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50 group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <FileIcon type={doc.type} className="text-[#f15922] flex-shrink-0" size={20} />
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate">{doc.name}</div>
                            {doc.description && (
                              <div className="text-sm text-gray-500 truncate">{doc.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {doc.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {getFolderPath(folders, doc.folder_id)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(doc.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatFileSize(doc.size)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDownload(doc)}
                            className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center"
                            title="Télécharger"
                          >
                            <Download size={20} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(doc)}
                            className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center"
                            title="Supprimer définitivement"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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