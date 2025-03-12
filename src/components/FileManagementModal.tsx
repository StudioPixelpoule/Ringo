import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, AlertTriangle, FileText, FileSpreadsheet, FileAudio, File as FilePdf } from 'lucide-react';
import { useDocumentStore, Document } from '../lib/documentStore';
import { supabase } from '../lib/supabase';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface FileManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function getFileIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'pdf':
      return <FilePdf className="text-red-500" />;
    case 'docx':
    case 'doc':
      return <FileText className="text-blue-500" />;
    case 'mp3':
    case 'wav':
      return <FileAudio className="text-purple-500" />;
    default:
      return <FileText className="text-gray-500" />;
  }
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

      // Then, update the document record to clear processed content
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          content: null,
          processed: false
        })
        .eq('id', deleteConfirmation.document.id);

      if (updateError) throw updateError;

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
    } finally {
      setDeleteConfirmation({ isOpen: false, document: null });
    }
  };

  const getSortIcon = (key: keyof Document) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-xl shadow-xl w-[90vw] max-w-6xl mx-4 overflow-hidden"
        >
          <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between">
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

          <div className="p-6">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertTriangle size={20} />
                <span>{error}</span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">
                      <button
                        onClick={() => handleSort('name')}
                        className="text-gray-600 font-medium hover:text-gray-900 flex items-center gap-1"
                      >
                        Nom {getSortIcon('name')}
                      </button>
                    </th>
                    <th className="text-left py-3 px-4">
                      <button
                        onClick={() => handleSort('type')}
                        className="text-gray-600 font-medium hover:text-gray-900 flex items-center gap-1"
                      >
                        Type {getSortIcon('type')}
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 w-1/3">Chemin</th>
                    <th className="text-left py-3 px-4">
                      <button
                        onClick={() => handleSort('created_at')}
                        className="text-gray-600 font-medium hover:text-gray-900 flex items-center gap-1"
                      >
                        Date d'ajout {getSortIcon('created_at')}
                      </button>
                    </th>
                    <th className="text-right py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-500">
                        Chargement...
                      </td>
                    </tr>
                  ) : sortedDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-500">
                        Aucun fichier trouvé
                      </td>
                    </tr>
                  ) : (
                    sortedDocuments.map((doc) => (
                      <tr key={doc.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getFileIcon(doc.type)}
                            <span className="truncate">{doc.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="uppercase text-sm font-medium text-gray-600">
                            {doc.type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-600">
                            {getFolderPath(folders, doc.folder_id)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {formatDate(doc.created_at)}
                        </td>
                        <td className="py-3 px-4 text-right">
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
        </motion.div>

        <DeleteConfirmationModal
          isOpen={deleteConfirmation.isOpen}
          title="Supprimer le fichier"
          message={`Êtes-vous sûr de vouloir supprimer le fichier "${deleteConfirmation.document?.name}" ? Cette action est irréversible.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteConfirmation({ isOpen: false, document: null })}
        />
      </motion.div>
    </AnimatePresence>
  );
}