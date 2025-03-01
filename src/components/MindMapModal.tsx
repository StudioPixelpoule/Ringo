import React, { useMemo, useEffect, useState, useCallback } from 'react';
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
  ConnectionMode,
  Panel,
  useReactFlow,
  MiniMap,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Document } from '../lib/types';
import { X, File, Folder, Share2, FileText, FileSpreadsheet, File as FilePdf, ZoomIn, ZoomOut, Search, Info } from 'lucide-react';
import { AudioIcon } from './AudioIcon';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

interface MindMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: Document[];
  onSendToConversation?: (document: Document) => void;
}

interface FolderStructure {
  name: string;
  path: string;
  documents: Document[];
  subfolders: FolderStructure[];
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

const RootNode = ({ data }: NodeProps) => (
  <div className="relative flex items-center justify-center w-40 h-40 rounded-full bg-[#f15922] text-white shadow-xl border-4 border-white transition-transform hover:scale-105">
    <Handle type="source" position={Position.Bottom} className="!bg-[#f15922]" />
    <div className="text-center p-4">
      <div className="text-2xl font-bold mb-2">{data.label}</div>
      <div className="text-sm opacity-75">{data.documents} documents</div>
    </div>
  </div>
);

const FolderNode = ({ data }: NodeProps) => (
  <div className="relative flex flex-col items-center p-4 rounded-xl bg-[#2f5c54] text-white shadow-xl min-w-[200px] transition-transform hover:scale-105">
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

const DocumentNode = ({ data }: NodeProps) => (
  <div className="relative flex flex-col items-center p-4 rounded-xl bg-[#dba747] text-white shadow-xl min-w-[180px] max-w-[250px] transition-transform hover:scale-105">
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
          data.onClose();
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

export const MindMapModal: React.FC<MindMapModalProps> = (props) => {
  if (!props.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl w-[95vw] h-[90vh] overflow-hidden">
        <button
          onClick={props.onClose}
          className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors z-10"
        >
          <X size={20} className="text-gray-500" />
        </button>
        
        <ReactFlowProvider>
          <MindMapContent {...props} />
        </ReactFlowProvider>
      </div>
    </div>
  );
};

const MindMapContent: React.FC<MindMapModalProps> = ({ 
  isOpen, 
  onClose, 
  documents,
  onSendToConversation
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>(documents);
  const [processedDocuments, setProcessedDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [layoutType, setLayoutType] = useState<'radial' | 'hierarchical' | 'force'>('radial');
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);
  const [highlightedEdges, setHighlightedEdges] = useState<string[]>([]);
  const [showMinimap, setShowMinimap] = useState<boolean>(false);
  const reactFlowInstance = useReactFlow();
  
  // Document info for stats
  const documentInfo = useMemo(() => {
    const info = {
      totalCount: filteredDocuments.length,
      byType: {} as Record<string, number>
    };
    
    filteredDocuments.forEach(doc => {
      const extension = doc.name.split('.').pop()?.toLowerCase() || 'unknown';
      info.byType[extension] = (info.byType[extension] || 0) + 1;
    });
    
    return info;
  }, [filteredDocuments]);
  
  // Fonction pour organiser les documents en structure de dossiers
  const buildFolderStructure = useCallback((docs: Document[]): FolderStructure => {
    const root: FolderStructure = {
      name: 'IRSST',
      path: '',
      documents: [],
      subfolders: []
    };
    
    // Créer un map pour stocker les dossiers
    const folderMap = new Map<string, FolderStructure>();
    folderMap.set('', root);
    
    // Trier les documents par dossier
    docs.forEach(doc => {
      if (!doc.folder) {
        root.documents.push(doc);
        return;
      }
      
      const folderPath = doc.folder;
      
      // Vérifier si le dossier existe déjà
      if (!folderMap.has(folderPath)) {
        // Créer le dossier et tous ses parents si nécessaire
        const parts = folderPath.split('/');
        let currentPath = '';
        
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          const parentPath = currentPath;
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          
          if (!folderMap.has(currentPath)) {
            const newFolder: FolderStructure = {
              name: part,
              path: currentPath,
              documents: [],
              subfolders: []
            };
            
            folderMap.set(currentPath, newFolder);
            
            // Ajouter au parent
            const parent = folderMap.get(parentPath);
            if (parent) {
              parent.subfolders.push(newFolder);
            }
          }
        }
      }
      
      // Ajouter le document au dossier
      const folder = folderMap.get(folderPath);
      if (folder) {
        folder.documents.push(doc);
      }
    });
    
    return root;
  }, []);
  
  // Fonction pour générer les nœuds et les arêtes à partir de la structure de dossiers
  const generateGraphFromFolderStructure = useCallback((structure: FolderStructure): { nodes: Node[], edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let nodeId = 0;
    
    // Ajouter le nœud racine
    const rootId = `node-${nodeId++}`;
    nodes.push({
      id: rootId,
      type: 'root',
      position: { x: 0, y: 0 },
      data: { 
        label: structure.name,
        documents: processedDocuments.length
      }
    });
    
    // Fonction récursive pour ajouter les dossiers et documents
    const addNodesAndEdges = (folder: FolderStructure, parentId: string, level: number, angle: number, radius: number) => {
      const totalItems = folder.subfolders.length + folder.documents.length;
      if (totalItems === 0) return;
      
      const angleStep = (2 * Math.PI) / totalItems;
      let currentAngle = angle - (angleStep * (totalItems - 1)) / 2;
      
      // Ajouter les sous-dossiers
      folder.subfolders.forEach(subfolder => {
        const folderId = `node-${nodeId++}`;
        const x = Math.cos(currentAngle) * radius;
        const y = Math.sin(currentAngle) * radius;
        
        nodes.push({
          id: folderId,
          type: 'folder',
          position: { x, y },
          data: { 
            label: subfolder.name,
            count: subfolder.documents.length + subfolder.subfolders.length
          }
        });
        
        edges.push({
          id: `edge-${parentId}-${folderId}`,
          source: parentId,
          target: folderId,
          type: 'smoothstep'
        });
        
        // Ajouter récursivement les sous-dossiers
        addNodesAndEdges(subfolder, folderId, level + 1, currentAngle, radius + 300);
        
        currentAngle += angleStep;
      });
      
      // Ajouter les documents
      folder.documents.forEach(doc => {
        const docId = `node-${nodeId++}`;
        const x = Math.cos(currentAngle) * radius;
        const y = Math.sin(currentAngle) * radius;
        
        nodes.push({
          id: docId,
          type: 'document',
          position: { x, y },
          data: { 
            label: doc.name,
            size: formatFileSize(doc.size),
            date: new Date(doc.created_at).toLocaleDateString(),
            originalDocument: doc,
            onSendToConversation,
            onClose
          }
        });
        
        edges.push({
          id: `edge-${parentId}-${docId}`,
          source: parentId,
          target: docId,
          type: 'smoothstep'
        });
        
        currentAngle += angleStep;
      });
    };
    
    // Générer le graphe
    addNodesAndEdges(structure, rootId, 1, Math.PI / 2, 300);
    
    return { nodes, edges };
  }, [processedDocuments, onSendToConversation, onClose]);
  
  // Effet pour filtrer les documents en fonction du terme de recherche
  useEffect(() => {
    if (searchTerm) {
      const filtered = processedDocuments.filter(doc => 
        doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.folder && doc.folder.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredDocuments(filtered);
    } else {
      setFilteredDocuments(processedDocuments);
    }
  }, [searchTerm, processedDocuments]);
  
  // Effet pour générer le graphe lorsque les documents filtrés changent
  useEffect(() => {
    if (filteredDocuments.length > 0) {
      const folderStructure = buildFolderStructure(filteredDocuments);
      const { nodes: newNodes, edges: newEdges } = generateGraphFromFolderStructure(folderStructure);
      setNodes(newNodes);
      setEdges(newEdges);
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [filteredDocuments, buildFolderStructure, generateGraphFromFolderStructure]);
  
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      
      const checkDocuments = async () => {
        const validDocs: Document[] = [];
        
        for (const doc of documents) {
          const fileExtension = doc.name.split('.').pop()?.toLowerCase();
          const isAudioFile = ['mp3', 'wav', 'ogg', 'm4a'].includes(fileExtension || '');
          
          if (isAudioFile) {
            try {
              const { data, error } = await supabase
                .from('document_contents')
                .select('content, extraction_status')
                .eq('document_id', doc.id)
                .single();
              
              if (error) {
                console.error('[MINDMAP] Erreur lors de la vérification du contenu audio:', error);
                logger.error('Erreur lors de la vérification du contenu audio', { documentId: doc.id, error }, 'MindMap');
                continue;
              }
              
              if (data) {
                if (data.extraction_status === 'success') {
                  validDocs.push(doc);
                  logger.info('Document audio ajouté à la mindmap (statut succès)', 
                    { documentId: doc.id, documentName: doc.name }, 
                    'MindMap');
                  continue;
                }
                
                if (data.content && 
                    data.content.length > 100 && 
                    !data.content.includes("Transcription en cours") &&
                    !data.content.includes("Ce document est un fichier audio") &&
                    !data.content.includes("transcription automatique a échoué")) {
                  validDocs.push(doc);
                  logger.info('Document audio ajouté à la mindmap (contenu valide)', 
                    { documentId: doc.id, documentName: doc.name }, 
                    'MindMap');
                  continue;
                }
                
                logger.info('Document audio non inclus dans la mindmap', 
                  { 
                    documentId: doc.id, 
                    documentName: doc.name, 
                    status: data.extraction_status,
                    contentPreview: data.content?.substring(0, 100) 
                  }, 
                  'MindMap');
              }
            } catch (error) {
              console.error('[MINDMAP] Erreur lors de la vérification du contenu audio:', error);
              logger.error('Erreur lors de la vérification du contenu audio', { documentId: doc.id, error }, 'MindMap');
            }
          } else {
            validDocs.push(doc);
          }
        }
        
        setFilteredDocuments(validDocs);
        setProcessedDocuments(validDocs);
        setIsLoading(false);
      };
      
      checkDocuments();
    }
  }, [isOpen, documents]);
  
  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    if (node.type === 'document' && node.data.originalDocument) {
      setSelectedDocument(node.data.originalDocument);
    } else {
      setSelectedDocument(null);
    }
  };
  
  const onPaneClick = () => {
    setSelectedDocument(null);
  };
  
  // Fonction pour centrer la vue sur le graphe
  const handleFitView = () => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.2 });
    }
  };
  
  // Effet pour centrer la vue lorsque le graphe est généré
  useEffect(() => {
    if (nodes.length > 0 && !isLoading) {
      setTimeout(() => {
        handleFitView();
      }, 100);
    }
  }, [nodes, isLoading]);
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <h2 className="text-xl font-semibold text-[#2F4F4F]">Base de données visuelle</h2>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Rechercher un document..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowMinimap(!showMinimap)}
            className="p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            title={showMinimap ? "Masquer la minimap" : "Afficher la minimap"}
          >
            <Info size={20} className="text-gray-600" />
          </button>
          <button
            onClick={handleFitView}
            className="p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            title="Ajuster la vue"
          >
            <ZoomIn size={20} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* ReactFlow */}
      <div className="w-full h-full">
        <ReactFlow
          nodes={nodes.map(node => ({
            ...node,
            className: highlightedNodes.includes(node.id) ? 'highlighted-node' : ''
          }))}
          edges={edges.map(edge => ({
            ...edge,
            className: highlightedEdges.includes(edge.id) ? 'highlighted-edge' : '',
            animated: highlightedEdges.includes(edge.id)
          }))}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          connectionMode={ConnectionMode.Loose}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
          fitView
        >
          <Background color="#f0f0f0" gap={16} />
          <Controls className="mindmap-toolbar" />
          {showMinimap && <MiniMap />}
          
          {/* Document info panel */}
          {selectedDocument && (
            <Panel position="bottom-right" className="bg-white p-4 rounded-lg shadow-lg max-w-md">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {getFileIcon(selectedDocument.name)}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-800 mb-1">{selectedDocument.name}</h3>
                  <div className="text-sm text-gray-600 mb-2">
                    <p>Taille: {formatFileSize(selectedDocument.size)}</p>
                    <p>Date: {new Date(selectedDocument.created_at).toLocaleString()}</p>
                    {selectedDocument.folder && <p>Dossier: {selectedDocument.folder}</p>}
                  </div>
                  {onSendToConversation && (
                    <button
                      onClick={() => {
                        onSendToConversation(selectedDocument);
                        onClose();
                      }}
                      className="px-4 py-2 bg-[#f15922] text-white rounded-lg hover:bg-[#d14811] transition-colors flex items-center gap-2"
                    >
                      <Share2 size={16} />
                      <span>Envoyer à la conversation</span>
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>
            </Panel>
          )}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-50">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f15922]"></div>
                <p className="mt-4 text-gray-600">Chargement des documents...</p>
              </div>
            </div>
          )}
          
          {/* Empty state */}
          {!isLoading && filteredDocuments.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-50">
              <div className="bg-white p-6 rounded-lg shadow-md max-w-md text-center">
                <Info className="mx-auto text-gray-400 mb-3" size={32} />
                <p className="text-gray-700 font-medium">Aucun document trouvé</p>
                <p className="text-gray-500 mt-2">
                  {searchTerm ? `Aucun résultat pour "${searchTerm}"` : 'Aucun document disponible.'}
                </p>
              </div>
            </div>
          )}
        </ReactFlow>
      </div>
    </div>
  );
};