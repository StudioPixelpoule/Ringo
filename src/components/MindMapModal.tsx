import React, { useMemo, useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  Handle,
  Position,
  NodeProps,
  useNodesState,
  useEdgesState,
  ConnectionMode
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Document } from '../lib/types';
import { X, File, Folder, Share2, FileText, FileSpreadsheet, File as FilePdf } from 'lucide-react';
import { AudioIcon } from './AudioIcon';
import { getDocumentContent } from '../lib/documentProcessor';

interface MindMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: Document[];
  onSendToConversation?: (document: Document) => void;
}

const COLORS = {
  root: '#f15922',
  folder: '#2f5c54',
  document: '#dba747'
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// Fonction pour obtenir l'icône appropriée en fonction du type de fichier
const getFileIcon = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  if (['doc', 'docx', 'txt', 'rtf'].includes(extension || '')) {
    return <FileText className="flex-shrink-0" size={32} />;
  } else if (['xls', 'xlsx', 'csv'].includes(extension || '')) {
    return <FileSpreadsheet className="flex-shrink-0" size={32} />;
  } else if (extension === 'pdf') {
    return <FilePdf className="flex-shrink-0" size={32} />;
  } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(extension || '')) {
    return <AudioIcon className="flex-shrink-0" size={32} />;
  } else {
    return <File className="flex-shrink-0" size={32} />;
  }
};

// Nœud personnalisé pour le centre (IRSST)
const RootNode = ({ data }: NodeProps) => (
  <div className="relative flex items-center justify-center w-40 h-40 rounded-full bg-[#f15922] text-white shadow-lg border-4 border-white">
    <Handle type="source" position={Position.Bottom} className="!bg-[#f15922]" />
    <div className="text-center p-4">
      <div className="text-2xl font-bold mb-2">{data.label}</div>
      <div className="text-sm opacity-75">{data.documents} documents</div>
    </div>
  </div>
);

// Nœud personnalisé pour les dossiers
const FolderNode = ({ data }: NodeProps) => (
  <div className="relative flex flex-col items-center p-4 rounded-xl bg-[#2f5c54] text-white shadow-lg min-w-[200px]">
    <Handle type="target" position={Position.Top} className="!bg-[#2f5c54]" />
    <div className="flex items-center justify-center w-full mb-2">
      <Folder className="flex-shrink-0" size={32} />
    </div>
    <div className="text-center w-full">
      <div className="font-medium text-lg mb-1 break-words">{data.label}</div>
      <div className="text-sm opacity-75">{data.count} éléments</div>
    </div>
    <Handle type="source" position={Position.Bottom} className="!bg-[#2f5c54]" />
  </div>
);

// Nœud personnalisé pour les documents
const DocumentNode = ({ data }: NodeProps) => (
  <div className="relative flex flex-col items-center p-4 rounded-xl bg-[#dba747] text-white shadow-lg min-w-[180px] max-w-[250px]">
    <Handle type="target" position={Position.Top} className="!bg-[#dba747]" />
    <div className="flex items-center justify-center w-full mb-2">
      {getFileIcon(data.label)}
    </div>
    <div className="text-center w-full">
      <div className="font-medium text-lg mb-2 break-words">{data.label}</div>
      <div className="text-sm opacity-75">{data.size}</div>
      <div className="text-sm opacity-75">{data.date}</div>
    </div>
    {data.onSendToConversation && (
      <button 
        onClick={(e) => {
          e.stopPropagation();
          console.log('[MINDMAP] Envoi du document à la conversation:', data.originalDocument);
          data.onSendToConversation(data.originalDocument);
          data.onClose(); // Close the modal when sending to conversation
        }}
        className="mt-3 px-3 py-1.5 bg-white text-[#dba747] rounded-lg flex items-center justify-center gap-1.5 mx-auto hover:bg-gray-100 transition-colors"
      >
        <Share2 size={14} />
        <span className="text-xs font-medium">Envoyer à la conversation</span>
      </button>
    )}
  </div>
);

const nodeTypes = {
  root: RootNode,
  folder: FolderNode,
  document: DocumentNode
};

interface FolderStructure {
  name: string;
  path: string;
  documents: Document[];
  subfolders: FolderStructure[];
}

export const MindMapModal: React.FC<MindMapModalProps> = ({ 
  isOpen, 
  onClose, 
  documents,
  onSendToConversation
}) => {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>(documents);
  const [processedDocuments, setProcessedDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Vérifier quels documents audio ont été transcrits
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      
      const checkDocuments = async () => {
        const validDocs: Document[] = [];
        
        for (const doc of documents) {
          // Vérifier si c'est un fichier audio
          const fileExtension = doc.name.split('.').pop()?.toLowerCase();
          const isAudioFile = ['mp3', 'wav', 'ogg', 'm4a'].includes(fileExtension || '');
          
          if (isAudioFile) {
            // Vérifier si le contenu existe et n'est pas un message d'attente
            try {
              const content = await getDocumentContent(doc.id);
              if (content && 
                  !content.includes("Pour les fichiers audio, une transcription est en cours") &&
                  !content.includes("Ce document est un fichier audio") &&
                  !content.includes("transcription automatique a échoué")) {
                validDocs.push(doc);
              }
            } catch (error) {
              console.error('[MINDMAP] Erreur lors de la vérification du contenu audio:', error);
            }
          } else {
            // Les documents non-audio sont toujours inclus
            validDocs.push(doc);
          }
        }
        
        setProcessedDocuments(validDocs);
        setIsLoading(false);
      };
      
      checkDocuments();
    }
  }, [isOpen, documents]);
  
  // Mettre à jour les documents filtrés lorsque les documents ou le terme de recherche changent
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredDocuments(processedDocuments);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredDocuments(
        processedDocuments.filter(doc => 
          doc.name.toLowerCase().includes(term) || 
          (doc.folder && doc.folder.toLowerCase().includes(term))
        )
      );
    }
  }, [processedDocuments, searchTerm]);
  
  // Construire la structure hiérarchique des dossiers
  const buildFolderStructure = (docs: Document[]): FolderStructure => {
    const root: FolderStructure = {
      name: 'IRSST',
      path: '',
      documents: [],
      subfolders: []
    };

    // Créer un dictionnaire des dossiers uniques de premier niveau
    const topLevelFolders = new Set<string>();
    docs.forEach(doc => {
      if (doc.folder) {
        const firstLevel = doc.folder.split('/')[0];
        topLevelFolders.add(firstLevel);
      }
    });

    // Créer les dossiers de premier niveau
    topLevelFolders.forEach(folderName => {
      root.subfolders.push({
        name: folderName,
        path: folderName,
        documents: [],
        subfolders: []
      });
    });

    // Fonction pour obtenir ou créer un dossier dans la structure
    const getOrCreateFolder = (path: string[], current: FolderStructure): FolderStructure => {
      if (path.length === 0) return current;

      const [folderName, ...rest] = path;
      let folder = current.subfolders.find(f => f.name === folderName);

      if (!folder) {
        folder = {
          name: folderName,
          path: current.path ? `${current.path}/${folderName}` : folderName,
          documents: [],
          subfolders: []
        };
        current.subfolders.push(folder);
      }

      return getOrCreateFolder(rest, folder);
    };

    // Organiser les documents dans la structure
    docs.forEach(doc => {
      if (!doc.folder) {
        root.documents.push(doc);
      } else {
        const path = doc.folder.split('/');
        const folder = getOrCreateFolder(path, root);
        folder.documents.push(doc);
      }
    });

    return root;
  };

  // Fonction pour calculer la position optimale des nœuds pour éviter les chevauchements
  const calculateOptimalLayout = (structure: FolderStructure, documents: Document[]) => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    // Ajouter le nœud racine (IRSST)
    nodes.push({
      id: 'root',
      type: 'root',
      position: { x: 0, y: 0 },
      data: {
        label: 'IRSST',
        documents: documents.length
      }
    });

    // Paramètres de mise en page
    const firstLevelCount = structure.subfolders.length;
    const xSpacing = 600; // Augmenté pour plus d'espace horizontal entre les nœuds
    const ySpacing = 300; // Augmenté pour plus d'espace vertical
    const folderRadius = 400; // Rayon pour disposer les dossiers autour de la racine
    const docSpacing = 250; // Espacement entre les documents
    
    // Disposition des dossiers de premier niveau en cercle autour de la racine
    structure.subfolders.forEach((folder, index) => {
      // Calculer l'angle pour une disposition circulaire
      const angle = (2 * Math.PI * index) / firstLevelCount;
      // Calculer les coordonnées x et y basées sur l'angle et le rayon
      const x = Math.cos(angle) * folderRadius;
      const y = Math.sin(angle) * folderRadius + 200; // Décalage vertical pour éviter de superposer avec la racine
      
      // Ajouter le nœud du dossier
      nodes.push({
        id: folder.path,
        type: 'folder',
        position: { x, y },
        data: {
          label: folder.name,
          count: folder.documents.length + folder.subfolders.length
        }
      });

      // Connecter à la racine
      edges.push({
        id: `edge-root-${folder.path}`,
        source: 'root',
        target: folder.path,
        type: 'smoothstep'
      });

      // Fonction récursive pour ajouter les sous-dossiers et documents
      const processSubfolder = (
        subfolder: FolderStructure,
        parentX: number,
        parentY: number,
        level: number,
        parentAngle: number
      ) => {
        const itemCount = subfolder.subfolders.length + subfolder.documents.length;
        const angleSpread = Math.PI / 3; // Angle de propagation des éléments enfants
        
        // Ajouter les sous-dossiers
        subfolder.subfolders.forEach((sub, subIndex) => {
          // Calculer un nouvel angle basé sur l'angle parent et la position relative
          const subAngle = parentAngle - (angleSpread / 2) + (angleSpread * subIndex / Math.max(1, subfolder.subfolders.length - 1));
          const distance = 300 + (level * 100); // Distance augmente avec le niveau
          
          const subX = parentX + Math.cos(subAngle) * distance;
          const subY = parentY + Math.sin(subAngle) * distance;

          nodes.push({
            id: sub.path,
            type: 'folder',
            position: { x: subX, y: subY },
            data: {
              label: sub.name,
              count: sub.documents.length + sub.subfolders.length
            }
          });

          edges.push({
            id: `edge-${subfolder.path}-${sub.path}`,
            source: subfolder.path,
            target: sub.path,
            type: 'smoothstep'
          });

          // Traiter récursivement les sous-dossiers
          processSubfolder(sub, subX, subY, level + 1, subAngle);
        });

        // Ajouter les documents en arc autour du dossier parent
        const docAngleSpread = Math.PI / 2; // Plus large pour les documents
        subfolder.documents.forEach((doc, docIndex) => {
          const docCount = subfolder.documents.length;
          // Calculer l'angle pour chaque document
          const docAngle = parentAngle - (docAngleSpread / 2) + (docAngleSpread * docIndex / Math.max(1, docCount - 1));
          const docDistance = 250; // Distance fixe pour les documents
          
          const docX = parentX + Math.cos(docAngle) * docDistance;
          const docY = parentY + Math.sin(docAngle) * docDistance;

          const docId = `doc-${doc.id}`;
          nodes.push({
            id: docId,
            type: 'document',
            position: { x: docX, y: docY },
            data: {
              label: doc.name,
              size: formatFileSize(doc.size),
              date: new Date(doc.created_at).toLocaleDateString(),
              originalDocument: doc,
              onSendToConversation: onSendToConversation,
              onClose: onClose
            }
          });

          edges.push({
            id: `edge-${subfolder.path}-${docId}`,
            source: subfolder.path,
            target: docId,
            type: 'smoothstep'
          });
        });
      };

      // Traiter les sous-dossiers et documents pour chaque dossier de premier niveau
      processSubfolder(folder, x, y, 1, angle);
    });

    // Ajouter les documents à la racine en cercle
    const rootDocs = structure.documents;
    if (rootDocs.length > 0) {
      const docAngleStep = (2 * Math.PI) / rootDocs.length;
      const docRadius = 250; // Rayon plus petit pour les documents de la racine
      
      rootDocs.forEach((doc, index) => {
        const docAngle = docAngleStep * index;
        const docX = Math.cos(docAngle) * docRadius;
        const docY = Math.sin(docAngle) * docRadius + 200; // Même décalage que pour les dossiers

        const docId = `doc-${doc.id}`;
        nodes.push({
          id: docId,
          type: 'document',
          position: { x: docX, y: docY },
          data: {
            label: doc.name,
            size: formatFileSize(doc.size),
            date: new Date(doc.created_at).toLocaleDateString(),
            originalDocument: doc,
            onSendToConversation: onSendToConversation,
            onClose: onClose
          }
        });

        edges.push({
          id: `edge-root-${docId}`,
          source: 'root',
          target: docId,
          type: 'smoothstep'
        });
      });
    }

    return { nodes, edges };
  };

  // Générer les nœuds et les liens avec le nouvel algorithme de mise en page
  const generateNodesAndEdges = useMemo(() => {
    console.log('[MINDMAP] Génération des nœuds et des liens pour', filteredDocuments.length, 'documents');
    const structure = buildFolderStructure(filteredDocuments);
    return calculateOptimalLayout(structure, filteredDocuments);
  }, [filteredDocuments, onSendToConversation, onClose]);

  const [nodes, setNodes] = useNodesState(generateNodesAndEdges.nodes);
  const [edges, setEdges] = useEdgesState(generateNodesAndEdges.edges);

  // Mettre à jour les nœuds et les liens lorsque les documents changent
  useEffect(() => {
    setNodes(generateNodesAndEdges.nodes);
    setEdges(generateNodesAndEdges.edges);
  }, [filteredDocuments, setNodes, setEdges, generateNodesAndEdges]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-50 bg-[#f8f7f2] rounded-2xl shadow-2xl w-[95vw] h-[90vh] overflow-hidden">
        <div className="absolute top-0 left-0 right-0 z-10 bg-white/90 backdrop-blur-sm p-4 border-b border-gray-100">
          <div className="max-w-screen-xl mx-auto flex items-center justify-between">
            <h2 className="text-xl font-medium text-gray-800 flex items-center gap-2">
              <span className="text-[#f15922]">IRSST</span>
              <span className="text-gray-400">/</span>
              <span>Base de données visuelle</span>
            </h2>
            
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher un document..."
                  className="w-64 px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-50 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className="w-full h-full pt-16">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f15922]"></div>
                <p className="mt-4 text-gray-600">Chargement des documents...</p>
              </div>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md p-6 bg-white/80 rounded-lg shadow-sm">
                <File className="mx-auto text-gray-400 mb-4" size={48} />
                <h3 className="text-xl font-medium text-gray-700 mb-2">
                  Aucun document disponible
                </h3>
                <p className="text-gray-500">
                  {searchTerm ? 
                    "Aucun document ne correspond à votre recherche." : 
                    "Aucun document n'est disponible pour affichage. Les fichiers audio en cours de transcription n'apparaissent pas dans la visualisation."}
                </p>
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              connectionMode={ConnectionMode.Loose}
              fitView
              minZoom={0.1}
              maxZoom={1.5}
              defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
              fitViewOptions={{
                padding: 0.2,
                includeHiddenNodes: false,
                minZoom: 0.1,
                maxZoom: 1.2
              }}
            >
              <Background />
              <Controls />
            </ReactFlow>
          )}
        </div>

        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-lg">
          <h3 className="text-xs font-medium text-gray-600 mb-3 uppercase tracking-wider">
            Légende
          </h3>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#f15922]" />
              <span className="text-xs text-gray-600">IRSST</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#2f5c54]" />
              <span className="text-xs text-gray-600">Dossiers</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#dba747]" />
              <span className="text-xs text-gray-600">Documents</span>
            </div>
          </div>
        </div>
        
        <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-lg">
          <h3 className="text-xs font-medium text-gray-600 mb-3 uppercase tracking-wider">
            Aide
          </h3>
          <p className="text-xs text-gray-600 max-w-xs">
            Cliquez sur un document et utilisez le bouton "Envoyer à la conversation" pour partager le document avec Ringo. 
            Il pourra alors analyser son contenu et répondre à vos questions.
          </p>
          <p className="text-xs text-gray-600 max-w-xs mt-2">
            Note: Les fichiers audio en cours de transcription n'apparaissent pas dans la visualisation.
          </p>
        </div>
      </div>
    </div>
  );
};