import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Search, X, Send, Loader2, CheckSquare, Square, Filter, FileText, List, Grid } from 'lucide-react';
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

interface FileListItemProps {
  document: Document;
  isSelected: boolean;
  onSelect: () => void;
}

const FileListItem: React.FC<FileListItemProps> = ({ document, isSelected, onSelect }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onSelect}
      className={`
        relative p-3 rounded-lg cursor-pointer transition-colors duration-200
        ${isSelected ? 'bg-[#f15922] text-white' : 'bg-white hover:bg-gray-50'}
        shadow-sm hover:shadow-md mb-2
      `}
    >
      <div className="flex items-center gap-3">
        <div className={`flex-shrink-0 text-[#dba747] ${isSelected ? 'text-white' : ''}`}>
          <FileIcon type={document.type} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium">{document.name}</h3>
          <div className="flex items-center gap-4 mt-1">
            <p className={`text-xs ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
              {document.type.toUpperCase()}
            </p>
            <p className={`text-xs ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
              {new Date(document.created_at).toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </p>
            {document.description && (
              <p className={`text-xs truncate ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                {document.description}
              </p>
            )}
          </div>
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
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'pdf' | 'doc' | 'data' | 'audio' | 'web'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
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
    linkDocument,
    linkMultipleDocuments
  } = useConversationStore();

  useEffect(() => {
    if (isOpen) {
      fetchFolders();
      fetchAllDocuments();
      // Focus search input when modal opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, fetchFolders, fetchAllDocuments]);

  // Set isSearching when search query changes
  useEffect(() => {
    setIsSearching(searchQuery.length > 0);
  }, [searchQuery]);

  const documentCounts = folders.reduce((acc, folder) => {
    acc[folder.id] = documents.filter(doc => doc.folder_id === folder.id).length;
    return acc;
  }, {} as Record<string, number>);

  const filteredDocuments = documents.filter(doc => {
    // When searching, ignore folder selection
    if (searchQuery) {
      const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (doc.description && doc.description.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchesSearch) return false;
    } else {
      // When not searching, filter by folder
      const matchesFolder = !selectedFolder || doc.folder_id === selectedFolder.id;
      if (!matchesFolder) return false;
    }
    
    // Filter by type
    if (typeFilter !== 'all' && doc.type !== typeFilter) return false;
    
    // Filter by date
    if (dateFilter !== 'all') {
      const docDate = new Date(doc.created_at);
      const now = new Date();
      
      switch (dateFilter) {
        case 'today':
          // Check if the document was created today
          return docDate.toDateString() === now.toDateString();
        
        case 'week':
          // Check if the document was created in the last 7 days
          const weekAgo = new Date();
          weekAgo.setDate(now.getDate() - 7);
          return docDate >= weekAgo;
        
        case 'month':
          // Check if the document was created in the last 30 days
          const monthAgo = new Date();
          monthAgo.setDate(now.getDate() - 30);
          return docDate >= monthAgo;
      }
    }
    
    return true;
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
      
      // Message personnalisé selon le nombre de documents
      const processingMessage = selectedDocs.length === 1 
        ? `Import de "${selectedDocs[0].name}"...`
        : `Import de ${selectedDocs.length} documents...`;
      
      if (!currentConversation) {
        // Créer une nouvelle conversation avec le premier document
        // Si on a plusieurs documents, on skip le message pour créer un message récapitulatif
        const skipMessage = selectedDocs.length > 1;
        await createConversationWithDocument(selectedDocs[0], skipMessage);
        
        // Ajouter les autres documents s'il y en a plus d'un
        if (selectedDocs.length > 1) {
          const allDocIds = selectedDocs.map(doc => doc.id);
          const result = await linkMultipleDocuments(allDocIds);
          
          if (result.errors.length > 0) {
            console.warn('Certains documents n\'ont pas pu être ajoutés:', result.errors);
          }
        }
      } else {
        // Ajouter tous les documents à la conversation existante
        const docIds = selectedDocs.map(doc => doc.id);
        const result = await linkMultipleDocuments(docIds);
        
        if (result.errors.length > 0 && result.addedCount === 0) {
          alert('Aucun document n\'a pu être ajouté. Ils sont peut-être déjà dans la conversation.');
        } else if (result.errors.length > 0) {
          console.warn('Certains documents n\'ont pas pu être ajoutés:', result.errors);
        }
      }
      
      // Réinitialiser et fermer
      setSelectedDocuments([]);
      onClose();
      
    } catch (error) {
      console.error('Failed to import documents:', error);
      alert('Erreur lors de l\'import des documents. Veuillez réessayer.');
    } finally {
      setIsProcessing(false);
      setSelectedDocuments([]);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDateFilter('all');
    setTypeFilter('all');
    setIsSearching(false);
    // Focus search input after clearing
    searchInputRef.current?.focus();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Clear search on Escape key
    if (e.key === 'Escape' && searchQuery) {
      setSearchQuery('');
      setIsSearching(false);
      e.preventDefault();
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
            <div className="relative w-64">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search size={16} className="text-gray-400" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Rechercher par mots-clés..."
                className="block w-full pl-10 pr-10 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-[#f15922] focus:border-[#f15922]"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearching(false);
                  }}
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                >
                  <X size={16} className="text-gray-400 hover:text-gray-600" />
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
          {/* Folder tree (25%) */}
          <div className={`${isSearching ? 'hidden' : 'w-1/4'} border-r p-4 overflow-y-auto`}>
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

          {/* Document list (50% or 75% depending on selection) */}
                      <div className={`flex-1 flex flex-col overflow-hidden ${isSearching ? 'w-3/4' : ''}`}>
              {/* Filters */}
              <div className="p-4 border-b bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {isSearching 
                      ? `Résultats de recherche pour "${searchQuery}"`
                      : selectedFolder 
                        ? selectedFolder.name 
                        : 'Tous les documents'
                    }
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={clearFilters}
                      className={`px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg ${
                        searchQuery === '' && dateFilter === 'all' && typeFilter === 'all' 
                          ? 'opacity-50 cursor-not-allowed' 
                          : ''
                      }`}
                      disabled={searchQuery === '' && dateFilter === 'all' && typeFilter === 'all'}
                    >
                      Effacer les filtres
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {/* Barre de recherche */}
                  <div className="relative">
                    <Search 
                      size={18} 
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => setIsSearchFocused(true)}
                      onBlur={() => setIsSearchFocused(false)}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="Rechercher des documents..."
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg transition-all ${
                        isSearchFocused 
                          ? 'bg-white border-[#f15922] shadow-sm' 
                          : 'bg-gray-50 hover:bg-white border-gray-200'
                      }`}
                    />
                  </div>
                  
                  {/* Filtres et actions */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value as any)}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-[#f15922]"
                      >
                        <option value="all">Toutes les dates</option>
                        <option value="today">Aujourd'hui</option>
                        <option value="week">Cette semaine</option>
                        <option value="month">Ce mois</option>
                      </select>
                      
                      <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as any)}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-[#f15922]"
                      >
                        <option value="all">Tous les types</option>
                        <option value="pdf">PDF</option>
                        <option value="doc">Word</option>
                        <option value="presentation">PowerPoint</option>
                        <option value="data">Données</option>
                        <option value="audio">Audio</option>
                        <option value="web">Web</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {filteredDocuments.length > 0 && (
                        <button
                          onClick={handleSelectAll}
                          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          title={selectedDocuments.length === filteredDocuments.length ? "Tout désélectionner" : "Tout sélectionner"}
                        >
                          {selectedDocuments.length === filteredDocuments.length
                            ? 'Tout désélectionner'
                            : `Tout sélectionner (${filteredDocuments.length})`}
                        </button>
                      )}
                      
                      <div className="flex items-center bg-white border border-gray-300 rounded-lg">
                        <button
                          onClick={() => setViewMode('grid')}
                          className={`p-1.5 ${viewMode === 'grid' ? 'text-[#f15922] bg-gray-50' : 'text-gray-400'}`}
                          title="Vue grille"
                        >
                          <Grid size={18} />
                        </button>
                        <div className="w-px h-6 bg-gray-300" />
                        <button
                          onClick={() => setViewMode('list')}
                          className={`p-1.5 ${viewMode === 'list' ? 'text-[#f15922] bg-gray-50' : 'text-gray-400'}`}
                          title="Vue liste"
                        >
                          <List size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            
            <div className="flex-1 p-4 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={32} className="animate-spin text-[#f15922]" />
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <FileText size={48} className="text-gray-300 mb-4" />
                  <p className="text-lg font-medium">Aucun document trouvé</p>
                  <p className="text-sm">Essayez de modifier vos critères de recherche</p>
                </div>
              ) : viewMode === 'grid' ? (
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
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {filteredDocuments.map(doc => (
                      <FileListItem
                        key={doc.id}
                        document={doc}
                        isSelected={selectedDocuments.includes(doc.id)}
                        onSelect={() => toggleDocumentSelection(doc.id)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
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