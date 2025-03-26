import React, { useState, useEffect, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Search, X, Send, Loader2, CheckSquare, Square, FolderPlus, Edit2, Trash2 } from 'lucide-react';
import { useDocumentStore, Document, Folder } from '../lib/documentStore';
import { useConversationStore } from '../lib/conversationStore';
import { FileIcon } from './FileIcon';
import { FolderModal } from './FolderModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface FileCardProps {
  document: Document;
  isSelected: boolean;
  onSelect: () => void;
}

const FileCard: React.FC<FileCardProps> = ({ document, isSelected, onSelect }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`
        relative p-4 rounded-xl cursor-pointer transition-colors duration-200
        ${isSelected ? 'bg-[#f15922] text-white' : 'bg-white hover:bg-gray-50'}
        shadow-lg hover:shadow-xl
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`text-[#dba747] ${isSelected ? 'text-white' : ''}`}>
          <FileIcon type={document.type} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{document.name}</h3>
          {document.description && (
            <p className={`text-sm truncate ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
              {document.description}
            </p>
          )}
          <p className={`text-sm truncate ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
            {new Date(document.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex-shrink-0">
          {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
        </div>
      </div>
    </motion.div>
  );
};

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

const FolderTreeItem = forwardRef<HTMLDivElement, FolderTreeItemProps>(({
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
}, ref) => {
  const hasChildren = folders.some(f => f.parent_id === folder.id);
  const isExpanded = expandedFolders.has(folder.id);
  const childFolders = folders.filter(f => f.parent_id === folder.id);
  const isSelected = selectedFolder?.id === folder.id;

  return (
    <motion.div
      ref={ref}
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
});

FolderTreeItem.displayName = 'FolderTreeItem';

interface FileExplorerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FileExplorer({ isOpen, onClose }: FileExplorerProps) {
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
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
    documents,
    loading,
    error,
    fetchFolders,
    fetchAllDocuments,
    setCurrentFolder,
    createFolder,
    deleteFolder,
    renameFolder,
  } = useDocumentStore();

  const {
    currentConversation,
    createConversationWithDocument,
    linkDocument
  } = useConversationStore();

  useEffect(() => {
    if (isOpen) {
      fetchFolders();
      fetchAllDocuments();
    }
  }, [isOpen, fetchFolders, fetchAllDocuments]);

  const handleFolderSelect = (folder: Folder) => {
    setSelectedFolder(folder);
    setCurrentFolder(folder);
    
    // Expand all parent folders
    const newExpanded = new Set(expandedFolders);
    let currentId = folder.parent_id;
    while (currentId) {
      newExpanded.add(currentId);
      const parentFolder = folders.find(f => f.id === currentId);
      currentId = parentFolder?.parent_id;
    }
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
      
      if (selectedFolder?.id === deleteConfirmation.folder.id) {
        setSelectedFolder(null);
        setExpandedFolders(new Set());
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

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = searchQuery.toLowerCase().split(/\s+/).every(term =>
      doc.name.toLowerCase().includes(term) ||
      (doc.description || '').toLowerCase().includes(term)
    );
    const matchesFolder = !selectedFolder || doc.folder_id === selectedFolder.id;
    return matchesSearch && matchesFolder;
  });

  const toggleDocumentSelection = (documentId: string) => {
    setSelectedDocuments(prev =>
      prev.includes(documentId)
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  const handleSelectAll = () => {
    if (selectedDocuments.length === filteredDocuments.length) {
      setSelectedDocuments([]);
    } else {
      setSelectedDocuments(filteredDocuments.map(doc => doc.id));
    }
  };

  const importDocumentsToChat = async () => {
    if (selectedDocuments.length === 0 || isProcessing) return;

    try {
      setIsProcessing(true);
      const selectedDocs = documents.filter(doc => selectedDocuments.includes(doc.id));
      
      if (!currentConversation) {
        await createConversationWithDocument(selectedDocs[0]);
        
        for (let i = 1; i < selectedDocs.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          await linkDocument(selectedDocs[i].id);
        }
      } else {
        for (const doc of selectedDocs) {
          await new Promise(resolve => setTimeout(resolve, 500));
          await linkDocument(doc.id);
        }
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to import documents:', error);
    } finally {
      setIsProcessing(false);
      setSelectedDocuments([]);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-xl shadow-xl w-[90vw] h-[80vh] flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-xl font-medium text-gray-900">Explorateur de Documents</h2>
            <div className="flex items-center gap-4">
              <div
                className={`
                  relative flex items-center transition-all duration-200
                  ${isSearchFocused ? 'w-96' : 'w-64 hover:w-96'}
                `}
              >
                <Search
                  size={16}
                  className={`
                    absolute left-3 transition-colors duration-200
                    ${isSearchFocused ? 'text-[#f15922]' : 'text-gray-400'}
                  `}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  placeholder="Rechercher par nom ou description..."
                  className={`
                    w-full pl-9 pr-8 py-1.5 bg-transparent rounded-lg text-sm
                    border border-gray-200 focus:border-[#f15922] focus:ring-2 focus:ring-[#f15922]/20
                    placeholder-gray-400 focus:outline-none transition-all duration-200
                    ${isSearchFocused ? 'text-gray-900' : 'text-gray-600'}
                  `}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 p-1 rounded-full hover:bg-gray-100"
                  >
                    <X size={14} className="text-gray-400" />
                  </button>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Folder tree - 1/3 width */}
            <div className="w-1/3 border-r p-4 overflow-y-auto">
              <div className="border rounded-lg overflow-hidden shadow-sm bg-white">
                <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                  <span className="font-medium text-sm text-gray-700">
                    Structure des dossiers
                  </span>
                  <button
                    onClick={() => handleCreateFolder(selectedFolder?.id ?? null)}
                    className="p-1.5 text-[#f15922] hover:bg-[#f15922]/10 rounded-full transition-colors"
                    title={selectedFolder ? "Nouveau sous-dossier" : "Nouveau dossier racine"}
                  >
                    <FolderPlus size={16} />
                  </button>
                </div>

                <div className="h-[calc(100%-48px)] overflow-y-auto p-2">
                  <AnimatePresence mode="popLayout">
                    {folders
                      .filter(f => !f.parent_id)
                      .map(folder => (
                        <FolderTreeItem
                          key={folder.id}
                          folder={folder}
                          level={0}
                          selectedFolder={selectedFolder}
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

            {/* Document list - 1/3 width */}
            <div className="w-1/3 border-r flex flex-col overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100"
                  >
                    {selectedDocuments.length === filteredDocuments.length ? (
                      <CheckSquare size={18} className="text-[#f15922]" />
                    ) : (
                      <Square size={18} className="text-gray-600" />
                    )}
                    <span className="text-sm font-medium">
                      {selectedDocuments.length === filteredDocuments.length
                        ? 'Tout désélectionner'
                        : 'Tout sélectionner'}
                    </span>
                  </button>
                  {selectedDocuments.length > 0 && (
                    <span className="text-sm text-gray-500">
                      {selectedDocuments.length} document{selectedDocuments.length > 1 ? 's' : ''} sélectionné{selectedDocuments.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-4">
                  <AnimatePresence>
                    {filteredDocuments.map(doc => (
                      <FileCard
                        key={doc.id}
                        document={doc}
                        isSelected={selectedDocuments.includes(doc.id)}
                        onSelect={() => toggleDocumentSelection(doc.id)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Selection panel - 1/3 width */}
            <div className="w-1/3 bg-gray-50 flex flex-col">
              <div className="p-4 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900">
                    Sélection ({selectedDocuments.length})
                  </h3>
                  <button
                    onClick={() => setSelectedDocuments([])}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto mb-4">
                  <div className="space-y-2">
                    {selectedDocuments.map(id => {
                      const doc = documents.find(d => d.id === id);
                      if (!doc) return null;
                      return (
                        <motion.div
                          key={doc.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="flex items-center justify-between bg-white p-2 rounded-lg shadow-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{doc.name}</p>
                            {doc.description && (
                              <p className="truncate text-xs text-gray-500">{doc.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => toggleDocumentSelection(doc.id)}
                            className="ml-2 text-gray-400 hover:text-gray-600"
                          >
                            <X size={14} />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={importDocumentsToChat}
                  disabled={selectedDocuments.length === 0 || isProcessing}
                  className="chat-neumorphic-button w-full py-2 rounded-lg flex items-center justify-center gap-2 text-[#f15922] disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Envoi en cours...</span>
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      <span>Envoyer au chat</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
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
    </>
  );
}