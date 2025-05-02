import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, Upload, FileText, FolderPlus, ChevronRight, Edit2, Trash2, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDocumentStore, Document, Folder } from '../lib/documentStore';
import { supabase } from '../lib/supabase';
import { FileIcon } from './FileIcon';
import { logError } from '../lib/errorLogger';
import { uploadFileInChunks } from '../lib/uploadUtils';
import { processAudioFile } from '../lib/audioProcessor';
import { processDocument } from '../lib/documentProcessor';

// Maximum file size for direct upload (500MB)
const MAX_DIRECT_UPLOAD_SIZE = 500 * 1024 * 1024;

interface ProcessingStatus {
  isProcessing: boolean;
  progress: number;
  stage: 'preparation' | 'processing' | 'extraction' | 'complete';
  message: string;
  canCancel?: boolean;
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

export function DocumentImportModal() {
  const [selectedPath, setSelectedPath] = useState<Folder[]>([]);
  const [description, setDescription] = useState('');
  const [audioDescription, setAudioDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    progress: 0,
    stage: 'preparation',
    message: ''
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    isModalOpen,
    folders,
    documents,
    currentFolder,
    loading,
    error,
    uploadDocument,
    fetchFolders,
    fetchAllDocuments,
    setModalOpen,
    createFolder,
    deleteFolder,
    renameFolder,
    setCurrentFolder,
    clearError,
  } = useDocumentStore();

  useEffect(() => {
    if (isModalOpen) {
      fetchFolders();
      fetchAllDocuments();

      const pendingImport = localStorage.getItem('pendingReportImport');
      if (pendingImport) {
        const importData = JSON.parse(pendingImport);
        const file = new File([importData.content], importData.name, {
          type: importData.type
        });
        setSelectedFile(file);
        setDescription('Rapport généré automatiquement');
        localStorage.removeItem('pendingReportImport');
      } else if (!processingStatus.isProcessing) {
        setProcessingStatus({
          isProcessing: false,
          progress: 0,
          stage: 'preparation',
          message: ''
        });
        setSelectedFile(null);
        setDescription('');
        setAudioDescription('');
      }
    }

    return () => {
      if (processingStatus.isProcessing && abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [isModalOpen, fetchFolders, fetchAllDocuments, processingStatus.isProcessing]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0 && !processingStatus.isProcessing) {
      const file = acceptedFiles[0];
      setSelectedFile(file);

      setProcessingStatus({
        isProcessing: false,
        progress: 0,
        stage: 'preparation',
        message: ''
      });
    }
  }, [processingStatus.isProcessing]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/json': ['.json'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'audio/mpeg': ['.mp3'],
      'audio/wav': ['.wav'],
      'audio/wave': ['.wav'],
      'audio/x-wav': ['.wav'],
      'audio/aac': ['.aac'],
      'audio/ogg': ['.ogg'],
      'audio/webm': ['.webm'],
      'audio/mp4': ['.mp4'],
      'audio/mpga': ['.mpga'],
      'audio/m4a': ['.m4a'],
      'text/html': ['.html']
    },
    multiple: false,
    disabled: processingStatus.isProcessing
  });

  // Calculate document counts for each folder
  const documentCounts = folders.reduce((acc, folder) => {
    acc[folder.id] = documents.filter(doc => doc.folder_id === folder.id).length;
    return acc;
  }, {} as Record<string, number>);

  // Detect if the file is an audio file
  const isAudioFile = selectedFile && 
    (selectedFile.type.startsWith('audio/') || 
     ['mp3', 'wav', 'wave', 'aac', 'ogg', 'webm', 'm4a', 'mp4', 'mpga'].includes(selectedFile.name.split('.').pop()?.toLowerCase() || ''));

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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFolder || !selectedFile || processingStatus.isProcessing) return;

    abortControllerRef.current = new AbortController();
    
    try {
      setProcessingStatus({
        isProcessing: true,
        progress: 0,
        stage: 'preparation',
        message: 'Préparation...',
        canCancel: true
      });

      const extension = selectedFile.name.split('.').pop()?.toLowerCase();
      const documentType = extension === 'pdf' ? 'pdf' :
                       ['doc', 'docx'].includes(extension || '') ? 'doc' :
                       ['json', 'csv', 'xlsx', 'xls'].includes(extension || '') ? 'data' :
                       ['mp3', 'wav', 'wave', 'aac', 'ogg', 'webm', 'm4a', 'mp4', 'mpga'].includes(extension || '') ? 'audio' :
                       extension === 'html' ? 'report' : 'unknown';

      if (documentType === 'audio') {
        try {
          const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || '';
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `documents/${fileName}`;

          setProcessingStatus({
            isProcessing: true,
            progress: 30,
            stage: 'processing',
            message: 'Téléversement du fichier audio...',
            canCancel: true
          });

          // Always use chunked upload for audio files
          const uploadedPath = await uploadFileInChunks(
            selectedFile,
            filePath,
            (progress) => {
              setProcessingStatus({
                isProcessing: true,
                progress: 30 + (progress.progress * 0.3),
                stage: 'processing',
                message: progress.message,
                canCancel: true
              });
            },
            abortControllerRef.current.signal
          );

          // Create document record with chunking info and both descriptions
          const { data: doc, error: docError } = await supabase
            .from('documents')
            .insert([{
              folder_id: currentFolder.id,
              name: selectedFile.name,
              type: documentType,
              description: description,
              group_name: audioDescription,
              url: uploadedPath,
              size: selectedFile.size,
              is_chunked: true,
              manifest_path: `${filePath}_manifest.json`
            }])
            .select()
            .single();

          if (docError) throw docError;

          // Process audio
          const result = await processAudioFile(
            selectedFile,
            import.meta.env.VITE_OPENAI_API_KEY,
            audioDescription,
            (progress) => {
              setProcessingStatus({
                isProcessing: true,
                progress: 60 + (progress.progress * 0.3),
                stage: progress.stage,
                message: progress.message,
                canCancel: true
              });
            },
            abortControllerRef.current.signal
          );

          // Store transcription content
          const { error: contentError } = await supabase
            .from('document_contents')
            .insert([{
              document_id: doc.id,
              content: JSON.stringify(result),
              is_chunked: false,
              chunk_index: null,
              total_chunks: null
            }]);

          if (contentError) throw contentError;

          setProcessingStatus({
            isProcessing: false,
            progress: 100,
            stage: 'complete',
            message: 'Document traité avec succès !'
          });

          setTimeout(() => {
            setSelectedFile(null);
            setDescription('');
            setAudioDescription('');
            setModalOpen(false);
          }, 2000);

          return;
        } catch (error) {
          console.error('Error processing audio:', error);
          throw error;
        }
      }

      // For other file types, use chunked upload if necessary
      if (selectedFile.size > MAX_DIRECT_UPLOAD_SIZE) {
        const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || '';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `documents/${fileName}`;

        const uploadedPath = await uploadFileInChunks(
          selectedFile,
          filePath,
          (progress) => {
            setProcessingStatus({
              isProcessing: true,
              progress: progress.progress * 0.5,
              stage: 'processing',
              message: progress.message,
              canCancel: true
            });
          },
          abortControllerRef.current.signal
        );

        // Create document record with chunking info
        const { data: doc, error: docError } = await supabase
          .from('documents')
          .insert([{
            folder_id: currentFolder.id,
            name: selectedFile.name,
            type: documentType,
            description: description,
            url: uploadedPath,
            size: selectedFile.size,
            is_chunked: true,
            manifest_path: `${filePath}_manifest.json`
          }])
          .select()
          .single();

        if (docError) throw docError;

        // Process and store content
        const result = await processDocument(selectedFile, {
          signal: abortControllerRef.current.signal,
          onProgress: (progress) => {
            setProcessingStatus({
              isProcessing: true,
              progress: 50 + (progress.progress * 0.5),
              stage: progress.stage,
              message: progress.message,
              canCancel: true
            });
          }
        });

        // Store content
        const { error: contentError } = await supabase
          .from('document_contents')
          .insert([{
            document_id: doc.id,
            content: result,
            is_chunked: false,
            chunk_index: null,
            total_chunks: null
          }]);

        if (contentError) throw contentError;
      } else {
        // Regular upload for small files
        const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || '';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `documents/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Create document record
        const { data: doc, error: docError } = await supabase
          .from('documents')
          .insert([{
            folder_id: currentFolder.id,
            name: selectedFile.name,
            type: documentType,
            description: description,
            url: filePath,
            size: selectedFile.size,
            is_chunked: false,
            manifest_path: null
          }])
          .select()
          .single();

        if (docError) throw docError;

        // Process and store content
        const result = await processDocument(selectedFile, {
          signal: abortControllerRef.current.signal,
          onProgress: (progress) => {
            setProcessingStatus({
              isProcessing: true,
              progress: progress.progress,
              stage: progress.stage,
              message: progress.message,
              canCancel: true
            });
          }
        });

        // Store content
        const { error: contentError } = await supabase
          .from('document_contents')
          .insert([{
            document_id: doc.id,
            content: result,
            is_chunked: false,
            chunk_index: null,
            total_chunks: null
          }]);

        if (contentError) throw contentError;
      }

      setProcessingStatus({
        isProcessing: false,
        progress: 100,
        stage: 'complete',
        message: 'Document traité avec succès !'
      });

      setTimeout(() => {
        setSelectedFile(null);
        setDescription('');
        setAudioDescription('');
        setModalOpen(false);
      }, 2000);

    } catch (error) {
      if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Processing cancelled')) {
        setProcessingStatus({
          isProcessing: false,
          progress: 0,
          stage: 'preparation',
          message: 'Traitement annulé'
        });
      } else {
        logError(error instanceof Error ? error : new Error(String(error)));
        setProcessingStatus({
          isProcessing: false,
          progress: 0,
          stage: 'preparation',
          message: error instanceof Error ? error.message : 'Une erreur est survenue'
        });
      }
      
      setSelectedFile(null);
    } finally {
      abortControllerRef.current = null;
    }
  };

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl mx-4">
        <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-xl font-medium text-white flex items-center gap-2">
            <FileText size={24} />
            Importer un document
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (processingStatus.isProcessing && abortControllerRef.current) {
                  abortControllerRef.current.abort();
                }
                setModalOpen(false);
              }}
              className="text-white hover:text-white/90"
              disabled={processingStatus.isProcessing && !processingStatus.canCancel}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 p-6">
          {/* Left column - File upload (25%) */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Téléverser un document</h3>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-[#f15922] bg-[#f15922]/5'
                  : processingStatus.isProcessing
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                  : 'border-gray-300 hover:border-[#f15922] hover:bg-gray-50'
              }`}
            >
              <input {...getInputProps()} disabled={processingStatus.isProcessing} />
              <div className="flex flex-col items-center justify-center">
                {selectedFile ? (
                  <FileIcon file={selectedFile} size={48} />
                ) : (
                  <Upload
                    size={48}
                    className={`mx-auto mb-4 ${
                      isDragActive ? 'text-[#f15922]' : 'text-gray-400'
                    }`}
                  />
                )}
                <p className="text-lg font-medium text-gray-900 mb-2">
                  {selectedFile ? selectedFile.name : 'Déposez votre fichier ici'}
                </p>
                <p className="text-gray-500">ou</p>
                <button 
                  className={`mt-2 px-4 py-2 ${
                    processingStatus.isProcessing
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-[#f15922] hover:bg-[#f15922]/90'
                  } text-white rounded-md transition-colors`}
                  disabled={processingStatus.isProcessing}
                >
                  Parcourir
                </button>
              </div>
            </div>
          </div>

          {/* Middle column - Folder navigation (50%) */}
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

          {/* Right column - Document indexing (25%) */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Indexation du document</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez le document pour améliorer la recherche"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent resize-none"
                  rows={4}
                  disabled={processingStatus.isProcessing}
                />
              </div>

              {isAudioFile && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description Spécifique Audio
                  </label>
                  <textarea
                    value={audioDescription}
                    onChange={(e) => setAudioDescription(e.target.value)}
                    placeholder="Décrivez le contexte de cet enregistrement audio (sujet, participants, date...)"
                    className="w-full px-3 py-2 border border-[#dba747] bg-[#dba747]/5 rounded-md focus:outline-none focus:ring-2 focus:ring-[#dba747] focus:border-transparent resize-none"
                    rows={3}
                    disabled={processingStatus.isProcessing}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Cette description sera utilisée pour contextualiser la transcription audio.
                  </p>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!selectedFile || !currentFolder || processingStatus.isProcessing}
                className={`w-full mt-6 px-4 py-2 rounded-md flex items-center justify-center gap-2 ${
                  !selectedFile || !currentFolder || processingStatus.isProcessing
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
                    <Upload size={20} />
                    Téléverser le document
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
      </div>
    </div>
  );
}