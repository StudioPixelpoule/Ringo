import React, { useState, useEffect, useCallback } from 'react';
import { X, Upload, FolderPlus, File, Tag, Users, FileText, Check, AlertCircle, ChevronRight, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { processUploadedDocument } from '../lib/documentProcessor';
import type { Document } from '../lib/types';

interface ImportWindowProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onDocumentAdded: () => Promise<void>;
  folderStructure: any;
}

interface FolderStructure {
  [key: string]: {
    files: Document[];
    subfolders: FolderStructure;
  };
}

const DOCUMENT_TYPES = [
  { value: 'CR', label: 'Compte-rendu' },
  { value: 'SOND', label: 'Résultat de sondage' },
  { value: 'RAPPORT', label: 'Rapport d\'analyse' },
  { value: 'TABLEAU', label: 'Données tabulaires' },
  { value: 'TRANS', label: 'Transcription' },
  { value: 'AUDIO', label: 'Enregistrement sonore' }
];

const GROUP_TYPES = [
  { value: 'CA', label: 'Conseil d\'administration' },
  { value: 'CS', label: 'Conseil scientifique' },
  { value: 'IRSST', label: 'Personnel interne' },
  { value: 'CNESST', label: 'Partenaire institutionnel' },
  { value: 'EXT', label: 'Recherche externe' }
];

interface FolderColumnProps {
  title: string;
  folders: string[];
  files: Document[];
  selectedItem: string | null;
  onSelect: (folder: string) => void;
  onCreateNew: () => void;
  onDelete: (folder: string) => void;
  onDeleteFile: (file: Document) => void;
  isCreating: boolean;
  onCancelCreate: () => void;
  onConfirmCreate: (name: string) => void;
}

// Fonction pour formater la taille du fichier
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// Composant de colonne pour l'arborescence
const FolderColumn: React.FC<FolderColumnProps> = ({ 
  title, 
  folders, 
  files, 
  selectedItem, 
  onSelect, 
  onCreateNew, 
  onDelete, 
  onDeleteFile, 
  isCreating, 
  onCancelCreate, 
  onConfirmCreate 
}) => {
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [hoveredFile, setHoveredFile] = useState<string | null>(null);

  const handleCreate = () => {
    if (newFolderName.trim()) {
      onConfirmCreate(newFolderName.trim());
      setNewFolderName('');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <button
          onClick={onCreateNew}
          className="btn-neumorphic-light w-8 h-8 rounded-full flex items-center justify-center text-[#f15922] hover:text-[#d14811] transition-colors"
        >
          <FolderPlus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isCreating && (
          <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nouveau dossier"
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') onCancelCreate();
              }}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleCreate}
                className="flex-1 px-3 py-1.5 bg-[#f15922] text-white text-sm rounded-lg hover:bg-[#d14811] transition-colors"
              >
                Créer
              </button>
              <button
                onClick={onCancelCreate}
                className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {folders.length === 0 && files.length === 0 && !isCreating ? (
          <div className="h-full flex flex-col items-center justify-center py-8 text-center">
            <FolderPlus className="text-gray-300 mb-2" size={24} />
            <p className="text-sm text-gray-400">Dossier vide</p>
            <button
              onClick={onCreateNew}
              className="mt-2 text-[#f15922] hover:text-[#d14811] text-sm"
            >
              Créer un dossier
            </button>
          </div>
         ) : (
          <>
            {folders.map((folder) => (
              <div
                key={folder}
                className={`
                  group flex items-center gap-2 rounded-lg transition-all cursor-pointer
                  ${selectedItem === folder
                    ? 'bg-[#f15922] text-white font-medium shadow-sm'
                    : 'hover:bg-gray-50 text-gray-600'
                  }
                `}
                onClick={() => onSelect(folder)}
                onMouseEnter={() => setHoveredItem(folder)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <div className="flex-1 text-left px-3 py-2 text-sm flex items-center gap-2">
                  <FolderPlus size={16} className={selectedItem === folder ? 'text-white' : 'text-gray-400'} />
                  <span className="truncate">{folder}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(folder);
                  }}
                  className={`
                    p-2 rounded-lg mr-1 transition-all duration-200
                    ${hoveredItem === folder ? 'opacity-100' : 'opacity-0'}
                    ${selectedItem === folder 
                      ? 'hover:bg-white/10 text-white' 
                      : 'hover:bg-red-50 hover:text-red-600 text-gray-400'
                    }
                  `}
                  title="Supprimer le dossier"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {files.map((file) => (
              <div
                key={file.id}
                className="group flex items-center gap-2 rounded-lg transition-all hover:bg-gray-50 text-gray-600"
                onMouseEnter={() => setHoveredFile(file.id)}
                onMouseLeave={() => setHoveredFile(null)}
              >
                <div className="flex-1 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <File size={16} className="text-gray-400 flex-shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {formatFileSize(file.size)} • {new Date(file.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => onDeleteFile(file)}
                  className={`
                    p-2 rounded-lg mr-1 transition-all duration-200
                    ${hoveredFile === file.id ? 'opacity-100' : 'opacity-0'}
                    hover:bg-red-50 hover:text-red-600 text-gray-400
                  `}
                  title="Supprimer le fichier"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export const ImportWindow: React.FC<ImportWindowProps> = ({ 
  isOpen, 
  onClose, 
  userId,
  onDocumentAdded,
  folderStructure: initialFolderStructure
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [creatingInLevel, setCreatingInLevel] = useState<number | null>(null);
  const [metadata, setMetadata] = useState({
    type: '',
    group: '',
    description: ''
  });
  const [processingStatus, setProcessingStatus] = useState<string>('Préparation...');
  // Ajout d'un état local pour la structure des dossiers
  const [localFolderStructure, setLocalFolderStructure] = useState<FolderStructure>(initialFolderStructure);
  const [emptyFolders, setEmptyFolders] = useState<{[path: string]: boolean}>({});
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  
  // Vérifier si le fichier sélectionné est un fichier audio
  const fileExtension = selectedFile?.name.split('.').pop()?.toLowerCase();
  const isAudioFile = ['mp3', 'wav', 'ogg', 'm4a'].includes(fileExtension || '');

  // Mettre à jour la structure locale quand la structure initiale change
  useEffect(() => {
    if (isOpen) {
      const structure = JSON.parse(JSON.stringify(initialFolderStructure));
      setLocalFolderStructure(structure);
      
      // Préserver les dossiers vides
      const folders = extractAllFolderPaths(structure);
      const emptyFoldersMap: {[path: string]: boolean} = {};
      folders.forEach(path => {
        emptyFoldersMap[path] = true;
      });
      setEmptyFolders(emptyFoldersMap);
    }
  }, [initialFolderStructure, isOpen]);

  // Extraire tous les chemins de dossiers de la structure
  const extractAllFolderPaths = (structure: FolderStructure, parentPath: string = ''): string[] => {
    let paths: string[] = [];
    
    Object.keys(structure).forEach(key => {
      if (key === '') return;
      
      const currentPath = parentPath ? `${parentPath}/${key}` : key;
      paths.push(currentPath);
      
      if (structure[key] && structure[key].subfolders) {
        const subPaths = extractAllFolderPaths(structure[key].subfolders, currentPath);
        paths = [...paths, ...subPaths];
      }
    });
    
    return paths;
  };

  // Reset state when modal is opened
  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setSelectedFolder('');
      setCurrentPath([]);
      setMetadata({
        type: '',
        group: '',
        description: ''
      });
      setUploadError(null);
      setProcessingStatus('Préparation...');
      setUploadSuccess(false);
      setIsUploading(false);
    }
  }, [isOpen]);

  // Réinitialiser l'interface après un téléversement réussi
  useEffect(() => {
    if (uploadSuccess) {
      // Attendre un court délai pour montrer le message de succès
      const timer = setTimeout(() => {
        setSelectedFile(null);
        setMetadata({
          type: '',
          group: '',
          description: ''
        });
        setUploadSuccess(false);
        setIsUploading(false);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [uploadSuccess]);

  if (!isOpen) return null;

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleMetadataChange = (field: string, value: string) => {
    setMetadata(prev => ({ ...prev, [field]: value }));
  };

  // Fonction pour sanitizer le nom de fichier en remplaçant les caractères spéciaux
  const sanitizeFileName = (fileName: string): string => {
    // Remplacer les caractères accentués et spéciaux par leurs équivalents sans accent
    return fileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')  // Supprimer les accents
      .replace(/[^a-zA-Z0-9._-]/g, '_'); // Remplacer les autres caractères spéciaux par des underscores
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedFolder) return;
    
    setIsUploading(true);
    setUploadError(null);
    setProcessingStatus('Téléversement du fichier...');

    try {
      const fileExt = selectedFile.name.split('.').pop();
      
      // Sanitize les parties du nom de fichier
      const sanitizedType = sanitizeFileName(metadata.type);
      const sanitizedGroup = sanitizeFileName(metadata.group);
      const sanitizedDesc = sanitizeFileName(metadata.description);
      
      // Créer un nom de fichier sécurisé
      const fileName = `${sanitizedType}_${sanitizedGroup}_${sanitizedDesc}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      setProcessingStatus('Téléversement vers le stockage...');
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      setProcessingStatus('Enregistrement des métadonnées...');
      const { error: dbError, data: documentData } = await supabase
        .from('documents')
        .insert({
          name: fileName,
          type: selectedFile.type,
          size: selectedFile.size,
          url: publicUrl,
          user_id: userId,
          folder: selectedFolder
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Lancer le traitement du document en arrière-plan
      setProcessingStatus('Document téléversé avec succès!');
      
      // Marquer le téléversement comme réussi
      setUploadSuccess(true);
      
      // Déclencher le traitement du document en arrière-plan
      // sans bloquer l'interface utilisateur
      processUploadedDocument(documentData)
        .then(() => {
          console.log('Document traité avec succès en arrière-plan');
        })
        .catch(err => {
          console.error('Erreur lors du traitement en arrière-plan:', err);
        });

      // Rafraîchir la liste des documents
      await onDocumentAdded();
      
    } catch (err) {
      console.error('Erreur lors de l\'upload:', err);
      setUploadError('Erreur lors de l\'upload du fichier. Assurez-vous que le nom ne contient pas de caractères spéciaux.');
      setIsUploading(false);
      setUploadSuccess(false);
    }
  };

  // Fonction pour mettre à jour la structure des dossiers localement
  const updateLocalFolderStructure = (path: string[], folderName: string): FolderStructure => {
    // Créer une copie profonde de la structure actuelle
    const newStructure = JSON.parse(JSON.stringify(localFolderStructure)) as FolderStructure;
    
    // Si c'est un dossier de premier niveau
    if (path.length === 0) {
      if (!newStructure[folderName]) {
        newStructure[folderName] = {
          files: [],
          subfolders: {}
        };
      }
      
      // Ajouter au registre des dossiers vides
      setEmptyFolders(prev => ({...prev, [folderName]: true}));
    } else {
      // Pour les sous-dossiers, naviguer jusqu'au parent
      let current = newStructure;
      let currentPath = '';
      
      for (const folder of path) {
        if (!current[folder]) {
          current[folder] = {
            files: [],
            subfolders: {}
          };
        }
        current = current[folder].subfolders;
        currentPath = currentPath ? `${currentPath}/${folder}` : folder;
      }
      
      // Ajouter le nouveau dossier
      if (!current[folderName]) {
        current[folderName] = {
          files: [],
          subfolders: {}
        };
      }
      
      // Ajouter au registre des dossiers vides
      const fullPath = currentPath ? `${currentPath}/${folderName}` : folderName;
      setEmptyFolders(prev => ({...prev, [fullPath]: true}));
    }
    
    return newStructure;
  };

  const handleCreateFolder = async (path: string[], name: string) => {
    // Mettre à jour la structure locale des dossiers
    const updatedStructure = updateLocalFolderStructure(path, name);
    setLocalFolderStructure(updatedStructure);
    
    // Mettre à jour le chemin et le dossier sélectionné
    const newPath = [...path, name];
    setCurrentPath(newPath);
    setSelectedFolder(newPath.join('/'));
  };

  // Fonction pour supprimer uniquement le fichier spécifié
  const handleDeleteDocument = async (doc: Document) => {
    try {
      // Supprimer l'entrée de la base de données
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      // Extraire le nom du fichier de l'URL pour le supprimer du stockage
      const fileName = doc.url.split('/').pop();
      if (fileName) {
        const filePath = `${userId}/${fileName}`;
        
        // Supprimer le fichier du stockage
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([filePath]);

        if (storageError) {
          console.error('Erreur lors de la suppression du fichier dans le stockage:', storageError);
        }
      }

      // Mettre à jour la structure locale des dossiers en supprimant uniquement le fichier
      const updatedStructure = removeFileFromLocalStructure(doc);
      setLocalFolderStructure(updatedStructure);

      // Rafraîchir les données
      await onDocumentAdded();
    } catch (err) {
      console.error('Erreur lors de la suppression du fichier:', err);
    }
  };

  // Fonction pour supprimer un fichier de la structure locale
  const removeFileFromLocalStructure = (doc: Document): FolderStructure => {
    // Créer une copie profonde de la structure actuelle
    const newStructure = JSON.parse(JSON.stringify(localFolderStructure)) as FolderStructure;
    
    // Si le fichier n'est pas dans un dossier
    if (!doc.folder) {
      if (newStructure[''] && newStructure[''].files) {
        newStructure[''].files = newStructure[''].files.filter(file => file.id !== doc.id);
      }
      return newStructure;
    }
    
    // Si le fichier est dans un dossier
    const folderPath = doc.folder.split('/');
    let current = newStructure;
    
    // Naviguer jusqu'au dossier parent
    for (let i = 0; i < folderPath.length; i++) {
      const folder = folderPath[i];
      if (!current[folder]) {
        // Le dossier n'existe pas, rien à supprimer
        return newStructure;
      }
      
      if (i === folderPath.length - 1) {
        // Nous sommes dans le dossier contenant le fichier
        if (current[folder].files) {
          current[folder].files = current[folder].files.filter(file => file.id !== doc.id);
        }
      } else {
        // Continuer la navigation
        current = current[folder].subfolders;
      }
    }
    
    return newStructure;
  };

  // Fonction pour supprimer uniquement le dossier spécifié sans supprimer les fichiers
  const handleDeleteFolder = async (folderPath: string) => {
    try {
      // Supprimer le dossier de la structure locale
      const updatedStructure = removeFolderFromLocalStructure(folderPath);
      setLocalFolderStructure(updatedStructure);
      
      // Supprimer du registre des dossiers vides
      setEmptyFolders(prev => {
        const newEmptyFolders = {...prev};
        delete newEmptyFolders[folderPath];
        return newEmptyFolders;
      });
      
      // Si le dossier supprimé était sélectionné, revenir au niveau parent
      if (selectedFolder === folderPath || selectedFolder.startsWith(folderPath + '/')) {
        const pathParts = folderPath.split('/');
        const newPath = pathParts.slice(0, -1);
        setCurrentPath(newPath);
        setSelectedFolder(newPath.join('/'));
      }
    } catch (err) {
      console.error('Erreur lors de la suppression du dossier:', err);
    }
  };

  // Fonction pour supprimer un dossier de la structure locale
  const removeFolderFromLocalStructure = (folderPath: string): FolderStructure => {
    // Créer une copie profonde de la structure actuelle
    const newStructure = JSON.parse(JSON.stringify(localFolderStructure)) as FolderStructure;
    
    // Si c'est un dossier de premier niveau
    if (!folderPath.includes('/')) {
      delete newStructure[folderPath];
      return newStructure;
    }
    
    // Si c'est un sous-dossier
    const pathParts = folderPath.split('/');
    const folderName = pathParts.pop() || ''; // Dernier élément du chemin
    let current = newStructure;
    
    // Naviguer jusqu'au dossier parent
    for (const folder of pathParts) {
      if (!current[folder]) {
        // Le dossier parent n'existe pas, rien à supprimer
        return newStructure;
      }
      current = current[folder].subfolders;
    }
    
    // Supprimer le dossier
    if (current[folderName]) {
      delete current[folderName];
    }
    
    return newStructure;
  };

  // Fonction pour obtenir le contenu d'un niveau à partir de la structure locale
  const getLevelContent = (level: number): { folders: string[], files: Document[] } => {
    let current = localFolderStructure;
    
    // Pour le niveau racine (niveau 0)
    if (level === 0) {
      // Récupérer les dossiers de premier niveau
      let folders = Object.keys(current).filter(k => k !== '');
      
      // Ajouter les dossiers vides de premier niveau
      Object.keys(emptyFolders).forEach(path => {
        if (!path.includes('/') && !folders.includes(path)) {
          folders.push(path);
        }
      });
      
      return {
        folders: folders,
        files: current['']?.files || []
      };
    }

    // Si nous n'avons pas assez de chemin pour atteindre ce niveau
    if (currentPath.length < level) {
      return { folders: [], files: [] };
    }

    // Naviguer dans l'arborescence jusqu'au niveau demandé
    let path = currentPath.slice(0, level);
    let currentPathStr = path.join('/');
    
    for (let i = 0; i < path.length; i++) {
      const folder = path[i];
      
      if (!current[folder]) {
        // Vérifier si c'est un dossier vide que nous avons créé
        if (emptyFolders[path.slice(0, i+1).join('/')]) {
          return { folders: [], files: [] };
        }
        return { folders: [], files: [] };
      }
      
      if (i === path.length - 1) {
        // Nous sommes au niveau demandé
        let folders = Object.keys(current[folder].subfolders || {});
        
        // Ajouter les dossiers vides de ce niveau
        Object.keys(emptyFolders).forEach(emptyPath => {
          const parentPath = currentPathStr;
          if (emptyPath.startsWith(parentPath + '/')) {
            const parts = emptyPath.substring(parentPath.length + 1).split('/');
            if (parts.length === 1 && !folders.includes(parts[0])) {
              folders.push(parts[0]);
            }
          }
        });
        
        return {
          folders: folders,
          files: current[folder].files || []
        };
      }
      
      current = current[folder].subfolders;
    }

    return { folders: [], files: [] };
  };

  const isMetadataValid = metadata.type && metadata.group && metadata.description;

  // Composant pour la zone de téléversement
  const UploadZone = () => {
    // Si un téléversement est en cours de traitement
    if (isUploading) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-[#2F4F4F]">
              Téléversement en cours
            </h2>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-[#f15922] rounded-full flex items-center justify-center mb-4">
              {uploadSuccess ? (
                <Check className="text-white" size={32} />
              ) : (
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
              )}
            </div>
            
            <h3 className="text-xl font-medium text-gray-800 mb-2">
              {uploadSuccess ? 'Téléversement réussi!' : 'Téléversement en cours...'}
            </h3>
            
            <p className="text-gray-500 mb-8">
              {selectedFile?.name}
            </p>

            <p className="text-sm text-gray-600 mb-2">{processingStatus}</p>
            <div className="w-full max-w-md bg-[#f15922]/20 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-[#f15922] transition-all duration-300"
                style={{ width: uploadSuccess ? '100%' : '50%' }}
              />
            </div>
            
            {uploadSuccess && (
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setMetadata({
                    type: '',
                    group: '',
                    description: ''
                  });
                  setUploadSuccess(false);
                  setIsUploading(false);
                }}
                className="mt-6 px-4 py-2 bg-[#f15922] text-white rounded-lg hover:bg-[#d14811] transition-colors"
              >
                Téléverser un autre document
              </button>
            )}
          </div>
        </div>
      );
    }

    // Si un fichier est sélectionné, afficher l'état de sélection
    if (selectedFile) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-[#2F4F4F]">
              Document sélectionné
            </h2>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-[#f15922] rounded-full flex items-center justify-center mb-4">
              <Check className="text-white" size={32} />
            </div>
            
            <h3 className="text-xl font-medium text-gray-800 mb-2">
              {selectedFile.name}
            </h3>
            
            <p className="text-gray-500 mb-8">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>

            {!selectedFolder ? (
              <div className="bg-blue-50 p-4 rounded-lg text-blue-700 max-w-md">
                <AlertCircle className="mx-auto mb-2" size={24} />
                <p className="font-medium">Choisissez un dossier</p>
                <p className="text-sm opacity-75">
                  Sélectionnez un dossier de destination dans la colonne centrale
                </p>
              </div>
            ) : (
              <div className="bg-green-50 p-4 rounded-lg text-green-700 max-w-md">
                <Check className="mx-auto mb-2" size={24} />
                <p className="font-medium">Dossier sélectionné :</p>
                <p className="text-sm opacity-75">{selectedFolder}</p>
              </div>
            )}

            <button
              onClick={() => setSelectedFile(null)}
              className="mt-6 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Changer de fichier
            </button>
          </div>
        </div>
      );
    }

    // Zone de téléversement par défaut
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-[#2F4F4F]">
            Téléverser un document
          </h2>
        </div>

        {uploadError && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
            <p className="font-medium">Une erreur est survenue</p>
            <p className="text-sm mt-1">{uploadError}</p>
          </div>
        )}

        <div
          className={`
            flex-1 border-2 border-dashed rounded-xl transition-all duration-300
            flex flex-col items-center justify-center
            ${isDragging 
              ? 'border-[#f15922] bg-[#fff5f2]' 
              : 'border-gray-200 hover:border-[#f15922] hover:bg-[#fff5f2]'
            }
          `}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div className="text-center p-8">
            <div className="mb-4">
              <Upload 
                className={`mx-auto ${isDragging ? 'text-[#f15922]' : 'text-gray-400'}`}
                size={64}
              />
            </div>
            
            <div className="space-y-2 mb-6">
              <p className="text-xl font-medium text-gray-700">
                {isDragging ? 'Déposez ici' : 'Déposez votre fichier ici'}
              </p>
              <p className="text-gray-500">
                ou
              </p>
            </div>

            <label className="inline-flex items-center px-8 py-4 rounded-xl transition-all duration-300 cursor-pointer bg-[#f15922] text-white hover:bg-[#d14811] active:transform active:scale-95">
              <input
                type="file"
                className="hidden"
                onChange={handleFileSelect}
              />
              <span className="text-lg font-medium">
                Parcourir
              </span>
            </label>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl w-[95vw] h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-[#2F4F4F]">Importer un document</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Upload Zone */}
          <div className="w-1/3 border-r border-gray-100 p-6 overflow-y-auto">
            <UploadZone />
          </div>

          {/* Middle Panel - Folder Structure */}
          <div className="w-1/3 border-r border-gray-100 flex flex-col overflow-hidden">
            {/* Breadcrumb navigation */}
            <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
                <button
                  onClick={() => {
                    setCurrentPath([]);
                    setSelectedFolder('');
                  }}
                  className={`hover:text-[#f15922] transition-colors ${
                    currentPath.length === 0 ? 'font-medium text-[#f15922]' : ''
                  }`}
                >
                  IRSST
                </button>
                {currentPath.map((folder, index) => (
                  <React.Fragment key={folder}>
                    <ChevronRight size={14} className="text-gray-300" />
                    <button
                      onClick={() => {
                        const newPath = currentPath.slice(0, index + 1);
                        setCurrentPath(newPath);
                        setSelectedFolder(newPath.join('/'));
                      }}
                      className={`hover:text-[#f15922] transition-colors ${
                        index === currentPath.length - 1 ? 'font-medium text-[#f15922]' : ''
                      }`}
                    >
                      {folder}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Folder columns container with horizontal scroll */}
            <div className="flex-1 relative overflow-hidden">
              <div 
                className="absolute inset-0 flex transition-transform duration-300 ease-in-out"
                style={{
                  transform: `translateX(-${currentPath.length * 100}%)`
                }}
              >
                {/* Level 0 */}
                <div className="flex-none w-full h-full">
                  {(() => {
                    const { folders, files } = getLevelContent(0);
                    return (
                      <FolderColumn
                        title="Racine"
                        folders={folders}
                        files={files}
                        selectedItem={currentPath[0] || null}
                        onSelect={(folder) => {
                          setCurrentPath([folder]);
                          setSelectedFolder(folder);
                        }}
                        onCreateNew={() => setCreatingInLevel(0)}
                        onDelete={(folder) => handleDeleteFolder(folder)}
                        onDeleteFile={handleDeleteDocument}
                        isCreating={creatingInLevel === 0}
                        onCancelCreate={() => setCreatingInLevel(null)}
                        onConfirmCreate={(name) => {
                          handleCreateFolder([], name);
                          setCreatingInLevel(null);
                        }}
                      />
                    );
                  })()}
                </div>

                {/* Level 1 */}
                <div className="flex-none w-full h-full">
                  {(() => {
                    const { folders, files } = getLevelContent(1);
                    return (
                      <FolderColumn
                        title="Niveau 1"
                        folders={folders}
                        files={files}
                        selectedItem={currentPath[1] || null}
                        onSelect={(folder) => {
                          const newPath = [...currentPath.slice(0, 1), folder];
                          setCurrentPath(newPath);
                          setSelectedFolder(newPath.join('/'));
                        }}
                        onCreateNew={() => setCreatingInLevel(1)}
                        onDelete={(folder) => handleDeleteFolder([...currentPath.slice(0, 1), folder].join('/'))}
                        onDeleteFile={handleDeleteDocument}
                        isCreating={creatingInLevel === 1}
                        onCancelCreate={() => setCreatingInLevel(null)}
                        onConfirmCreate={(name) => {
                          handleCreateFolder(currentPath.slice(0, 1), name);
                          setCreatingInLevel(null);
                        }}
                      />
                    );
                  })()}
                </div>

                {/* Level 2 */}
                <div className="flex-none w-full h-full">
                  {(() => {
                    const { folders, files } = getLevelContent(2);
                    return (
                      <FolderColumn
                        title="Niveau 2"
                        folders={folders}
                        files={files}
                        selectedItem={currentPath[2] || null}
                        onSelect={(folder) => {
                          const newPath = [...currentPath.slice(0, 2), folder];
                          setCurrentPath(newPath);
                          setSelectedFolder(newPath.join('/'));
                        }}
                        onCreateNew={() => setCreatingInLevel(2)}
                        onDelete={(folder) => handleDeleteFolder([...currentPath.slice(0, 2), folder].join('/'))}
                        onDeleteFile={handleDeleteDocument}
                        isCreating={creatingInLevel === 2}
                        onCancelCreate={() => setCreatingInLevel(null)}
                        onConfirmCreate={(name) => {
                          handleCreateFolder(currentPath.slice(0, 2), name);
                          setCreatingInLevel(null);
                        }}
                      />
                    );
                  })()}
                </div>

                {/* Level 3 */}
                <div className="flex-none w-full h-full">
                  {(() => {
                    const { folders, files } = getLevelContent(3);
                    return (
                      <FolderColumn
                        title="Niveau 3"
                        folders={folders}
                        files={files}
                        selectedItem={currentPath[3] || null}
                        onSelect={(folder) => {
                          const newPath = [...currentPath.slice(0, 3), folder];
                          setCurrentPath(newPath);
                          setSelectedFolder(newPath.join('/'));
                        }}
                        onCreateNew={() => setCreatingInLevel(3)}
                        onDelete={(folder) => handleDeleteFolder([...currentPath.slice(0, 3), folder].join('/'))}
                        onDeleteFile={handleDeleteDocument}
                        isCreating={creatingInLevel === 3}
                        onCancelCreate={() => setCreatingInLevel(null)}
                        onConfirmCreate={(name) => {
                          handleCreateFolder(currentPath.slice(0, 3), name);
                          setCreatingInLevel(null);
                        }}
                      />
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Metadata */}
          <div className="w-1/3 overflow-y-auto">
            <div className="h-full p-6 flex flex-col">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-[#2F4F4F] mb-2">
                  Indexation du document
                </h3>
                <div className="text-sm text-gray-500">
                  <p>Fichier : <span className="font-medium text-gray-700">{selectedFile?.name || 'Aucun fichier sélectionné'}</span></p>
                  <p>Dossier : <span className="font-medium text-gray-700">{selectedFolder || 'Aucun dossier sélectionné'}</span></p>
                </div>
              </div>

              <div className="flex-1 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <FileText size={16} className="text-[#f15922]" />
                    Type de document
                  </label>
                  <select
                    value={metadata.type}
                    onChange={(e) => handleMetadataChange('type', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#f15922] focus:border-transparent transition-all"
                    disabled={!selectedFile || !selectedFolder || isUploading}
                  >
                    <option value="">Sélectionner un type</option>
                    {DOCUMENT_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Users size={16} className="text-[#f15922]" />
                    Groupe concerné
                  </label>
                  <select
                    value={metadata.group}
                    onChange={(e) => handleMetadataChange('group', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#f15922] focus:border-transparent transition-all"
                    disabled={!selectedFile || !selectedFolder || isUploading}
                  >
                    <option value="">Sélectionner un groupe</option>
                    {GROUP_TYPES.map(group => (
                      <option key={group.value} value={group.value}>
                        {group.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Tag size={16} className="text-[#f15922]" />
                    Description
                  </label>
                  <textarea
                    value={metadata.description}
                    onChange={(e) => handleMetadataChange('description', e.target.value)}
                    placeholder="Description du document (utilisez _ au lieu des espaces)"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#f15922] focus:border-transparent transition-all resize-none h-32"
                    disabled={!selectedFile || !selectedFolder || isUploading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Note: Les caractères spéciaux seront remplacés par des underscores (_).
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <button
                  onClick={handleUpload}
                  disabled={! selectedFile || !selectedFolder || !isMetadataValid || isUploading}
                  className={`
                    w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2
                    transition-all duration-300
                    ${selectedFile && selectedFolder && isMetadataValid && !isUploading
                      ? 'bg-[#f15922] text-white hover:bg-[#d14811]'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  <Upload size={20} />
                  <span className="font-medium">
                    {isUploading ? 'Traitement en cours...' : 'Téléverser le document'}
                  </span>
                </button>
                
                {isUploading && (
                  <p className="text-sm text-center mt-2 text-gray-600">
                    {isAudioFile 
                      ? 'Le fichier audio sera automatiquement transcrit après le téléversement' 
                      : 'Le document sera automatiquement traité pour extraction du contenu'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};