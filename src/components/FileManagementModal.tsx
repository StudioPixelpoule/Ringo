import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, AlertTriangle, ChevronUp, ChevronDown, FileText } from 'lucide-react';
import { useDocumentStore, Document } from '../lib/documentStore';
import { supabase } from '../lib/supabase';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { FileIcon } from './FileIcon';

interface FileManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  const { documents = [], folders = [], loading, error, fetchAllDocuments, fetchFolders } = useDocumentStore();
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    document: Document | null;
  }>({
    isOpen: false,
    document: null
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

  const sortedDocuments = [...(documents || [])].sort((a, b) => {
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

  const handleDeleteClick = (document: Document) => {
    setDeleteConfirmation({
      isOpen: true,
      document
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation.document) return;

    try {
      // First, delete the file from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([deleteConfirmation.document.url]);

      if (storageError) throw storageError;

      // Then, delete the document record
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', deleteConfirmation.document.id);

      if (dbError) throw dbError;

      // Refresh documents list
      await fetchAllDocuments();
    } catch (error) {
      console.error('Failed to delete document:', error);
    } finally {
      setDeleteConfirmation({ isOpen: false, document: null });
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col">
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

          <div className="bg-white rounded-lg overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('name')}
                      className="hover:text-gray-900 flex items-center gap-1 group"
                    >
                      <span>Nom</span>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chemin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('created_at')}
                      className="hover:text-gray-900 flex items-center gap-1 group"
                    >
                      <span>Date d'ajout</span>
                      <div className="relative flex items-center">
                        <SortIndicator columnKey="created_at" />
                      </div>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f15922]"></div>
                      </div>
                    </td>
                  </tr>
                ) : sortedDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      Aucun fichier trouvé
                    </td>
                  </tr>
                ) : (
                  sortedDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <FileIcon type={doc.type} className="text-[#f15922]" size={20} />
                          <span className="truncate max-w-[200px]">{doc.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {doc.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-600">
                          {getFolderPath(folders, doc.folder_id)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {formatDate(doc.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteClick(doc)}
                          className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-full transition-colors"
                          title="Supprimer le fichier"
                        >
                          <Trash2 size={18} />
                        </button>
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
        title="Supprimer le fichier"
        message={`Êtes-vous sûr de vouloir supprimer le fichier "${deleteConfirmation.document?.name}" ? Cette action est irréversible.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmation({ isOpen: false, document: null })}
      />
    </div>
  );
}