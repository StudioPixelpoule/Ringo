import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, Upload, FileText, FolderPlus, ChevronRight, Edit2, Trash2, Check, Loader2 } from 'lucide-react';
import { useDocumentStore, Document, Folder } from '../lib/documentStore';
import { supabase } from '../lib/supabase';
import { FileIcon } from './FileIcon';
import { logError } from '../lib/errorLogger';

interface ProcessingStatus {
  isProcessing: boolean;
  progress: number;
  stage: 'preparation' | 'processing' | 'extraction' | 'complete';
  message: string;
}

interface FolderColumnProps {
  folders: Folder[];
  level: number;
  parentId: string | null;
  selectedPath: Folder[];
  onSelect: (folder: Folder, level: number) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
}

const FolderColumn: React.FC<FolderColumnProps> = ({
  folders,
  level,
  parentId,
  selectedPath,
  onSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}) => {
  const currentFolders = folders.filter(f => f.parent_id === parentId);
  const selectedFolder = selectedPath[level];

  return (
    <div className="min-w-[200px] border-r border-gray-200 h-[400px] overflow-y-auto">
      <div className="p-2 border-b border-gray-200 flex items-center justify-between">
        <span className="font-medium text-sm text-gray-600">
          {parentId ? folders.find(f => f.id === parentId)?.name : 'Racine'}
        </span>
        <button
          onClick={() => onCreateFolder(parentId)}
          className="p-1 text-[#f15922] hover:bg-[#f15922]/10 rounded-full"
        >
          <FolderPlus size={16} />
        </button>
      </div>
      <div className="p-2">
        {currentFolders.map(folder => (
          <div
            key={folder.id}
            className={`group flex items-center justify-between p-2 rounded-md cursor-pointer ${
              selectedFolder?.id === folder.id
                ? 'bg-[#f15922] text-white'
                : 'hover:bg-gray-100'
            }`}
            onClick={() => onSelect(folder, level)}
          >
            <div className="flex items-center gap-2">
              <span className="truncate">{folder.name}</span>
              {folders.some(f => f.parent_id === folder.id) && (
                <ChevronRight size={16} className="flex-shrink-0" />
              )}
            </div>
            <div className={`hidden group-hover:flex items-center gap-1 ${
              selectedFolder?.id === folder.id ? 'text-white' : 'text-gray-500'
            }`}>
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
          </div>
        ))}
      </div>
    </div>
  );
};

export function DocumentImportModal() {
  const {
    isModalOpen,
    folders,
    currentFolder,
    loading,
    error,
    setModalOpen,
    createFolder,
    uploadDocument,
    fetchFolders,
    setCurrentFolder,
    deleteFolder,
    renameFolder,
    clearError,
  } = useDocumentStore();

  const [selectedPath, setSelectedPath] = useState<Folder[]>([]);
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    progress: 0,
    stage: 'preparation',
    message: ''
  });

  useEffect(() => {
    if (isModalOpen) {
      fetchFolders();

      // Check for pending report import
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
      }
    }
  }, [isModalOpen, fetchFolders, processingStatus.isProcessing]);

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
      'text/html': ['.html']
    },
    multiple: false,
    disabled: processingStatus.isProcessing
  });

  const handleUpload = async () => {
    if (!currentFolder || !selectedFile || processingStatus.isProcessing) return;
    
    try {
      setProcessingStatus({
        isProcessing: true,
        progress: 0,
        stage: 'preparation',
        message: 'Préparation du document...'
      });

      // Auto-detect document type
      const extension = selectedFile.name.split('.').pop()?.toLowerCase();
      const documentType = extension === 'pdf' ? 'pdf' :
                         ['doc', 'docx'].includes(extension || '') ? 'doc' :
                         ['json', 'csv', 'xlsx', 'xls'].includes(extension || '') ? 'data' :
                         ['mp3', 'wav', 'wave', 'aac', 'ogg', 'webm'].includes(extension || '') ? 'audio' :
                         extension === 'html' ? 'report' : 'unknown';

      // Convert special characters to underscores
      const sanitizedDescription = description
        .replace(/[^a-zA-Z0-9\s]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

      // For audio files, store the original file
      if (documentType === 'audio') {
        const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || '';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `documents/${fileName}`;

        setProcessingStatus({
          isProcessing: true,
          progress: 30,
          stage: 'processing',
          message: 'Téléversement du fichier audio...'
        });

        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('documents')
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: selectedFile.type
          });

        if (uploadError) throw uploadError;
        if (!uploadData?.path) throw new Error('Failed to upload file');

        setProcessingStatus({
          isProcessing: true,
          progress: 60,
          stage: 'processing',
          message: 'Traitement du fichier audio...'
        });

        const doc = await uploadDocument(selectedFile, currentFolder.id, {
          type: documentType,
          description: sanitizedDescription,
          processed: true,
          size: selectedFile.size,
          url: uploadData.path
        });

        setProcessingStatus({
          isProcessing: false,
          progress: 100,
          stage: 'complete',
          message: 'Document traité avec succès !'
        });

        setTimeout(() => {
          setSelectedFile(null);
          setDescription('');
          setModalOpen(false);
        }, 2000);

        return;
      }

      // For other document types, process normally
      const doc = await uploadDocument(selectedFile, currentFolder.id, {
        type: documentType,
        description: sanitizedDescription,
        processed: true,
        size: selectedFile.size
      });

      setProcessingStatus({
        isProcessing: false,
        progress: 100,
        stage: 'complete',
        message: 'Document traité avec succès !'
      });

      setTimeout(() => {
        setSelectedFile(null);
        setDescription('');
        setModalOpen(false);
      }, 2000);

    } catch (error) {
      console.error('Overall error:', error);
      logError(error instanceof Error ? error : new Error(String(error)));
      setProcessingStatus({
        isProcessing: false,
        progress: 0,
        stage: 'preparation',
        message: error instanceof Error ? error.message : 'Une erreur est survenue'
      });
      setSelectedFile(null);
    }
  };

  const handleFolderSelect = (folder: Folder, level: number) => {
    const newPath = selectedPath.slice(0, level);
    newPath[level] = folder;
    setSelectedPath(newPath);
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
        setSelectedPath([]);
      }
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
              onClick={() => !processingStatus.isProcessing && setModalOpen(false)}
              className="text-white hover:text-white/90"
              disabled={processingStatus.isProcessing}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 p-6">
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

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">IRSST</h3>
            <div className="border rounded-lg overflow-hidden">
              <div className="flex overflow-x-auto">
                <FolderColumn
                  folders={folders}
                  level={0}
                  parentId={null}
                  selectedPath={selectedPath}
                  onSelect={handleFolderSelect}
                  onCreateFolder={handleCreateFolder}
                  onRenameFolder={handleRenameFolder}
                  onDeleteFolder={handleDeleteFolder}
                />
                {selectedPath.map((folder, index) => (
                  <FolderColumn
                    key={folder.id}
                    folders={folders}
                    level={index + 1}
                    parentId={folder.id}
                    selectedPath={selectedPath}
                    onSelect={handleFolderSelect}
                    onCreateFolder={handleCreateFolder}
                    onRenameFolder={handleRenameFolder}
                    onDeleteFolder={handleDeleteFolder}
                  />
                ))}
              </div>
            </div>
          </div>

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