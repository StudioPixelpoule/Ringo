import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Search, X, Send, Loader2, CheckSquare, Square } from 'lucide-react';
import { useDocumentStore, Document, Folder } from '../lib/documentStore';
import { useConversationStore } from '../lib/conversationStore';
import { FileIcon } from './FileIcon';

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
  documentCounts: Record<string, number>;
  onSelect: (folder: Folder) => void;
}

const FolderTreeItem: React.FC<FolderTreeItemProps> = ({
  folder,
  level,
  selectedFolder,
  documentCounts,
  onSelect
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
                />
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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
  
  const {
    folders,
    documents,
    loading,
    error,
    fetchFolders,
    fetchAllDocuments
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

  const documentCounts = folders.reduce((acc, folder) => {
    acc[folder.id] = documents.filter(doc => doc.folder_id === folder.id).length;
    return acc;
  }, {} as Record<string, number>);

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
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
                ${isSearchFocused ? 'w-64' : 'w-48 hover:w-64'}
              `}
            >
              <div
                className={`
                  absolute inset-0 rounded-lg transition-all duration-200
                  ${isSearchFocused 
                    ? 'bg-white shadow-md' 
                    : 'bg-gray-100 group-hover:bg-gray-200'
                  }
                `}
              />
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
                placeholder="Rechercher..."
                className={`
                  w-full pl-9 pr-8 py-1.5 bg-transparent rounded-lg text-sm
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
          <div className="w-1/4 border-r p-4 overflow-y-auto">
            <div className="space-y-2">
              {folders
                .filter(f => !f.parent_id)
                .map(folder => (
                  <FolderTreeItem
                    key={folder.id}
                    folder={folder}
                    level={0}
                    selectedFolder={selectedFolder}
                    documentCounts={documentCounts}
                    onSelect={setSelectedFolder}
                  />
                ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
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
              <div className="grid grid-cols-2 gap-4">
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

          <AnimatePresence>
            {selectedDocuments.length > 0 && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: '300px', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="border-l bg-gray-50 flex flex-col"
              >
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
                            <span className="truncate text-sm">{doc.name}</span>
                            <button
                              onClick={() => toggleDocumentSelection(doc.id)}
                              className="text-gray-400 hover:text-gray-600"
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}