import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import * as d3 from 'd3';
import { X, ZoomIn, ZoomOut, MessageSquare, Loader2, Database } from 'lucide-react';
import { useDocumentStore } from '../lib/documentStore';
import { useConversationStore } from '../lib/conversationStore';

interface MindmapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Node {
  id: string;
  name: string;
  type: 'folder' | 'document';
  docType?: string;
  level: number;
  parentId?: string | null;
  count?: number;
  x?: number;
  y?: number;
  color?: string;
  fx?: number | null;
  fy?: number | null;
  processed?: boolean;
  content?: string;
}

interface Link {
  source: string;
  target: string;
}

const COLORS = {
  root: '#f15922',
  folder: {
    primary: '#106f69',
    secondary: '#dba747',
    tertiary: '#cfd3bd',
  },
  document: {
    unprocessed: '#FFFFFF',
    processed: '#E8F5E9',
    selected: '#f15922',
  },
  link: {
    default: '#106f69',
  },
};

export function MindmapModal({ isOpen, onClose }: MindmapModalProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<SVGGElement | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();
  
  const { 
    folders = [], 
    documents = [], 
    selectedDocuments = [],
    loading,
    error,
    fetchFolders, 
    fetchAllDocuments,
    selectDocument,
    unselectDocument,
    clearSelectedDocuments 
  } = useDocumentStore();

  console.log("📌 Documents avant filtrage :", documents);
  console.log("📌 Détails des documents :");
  documents.forEach(doc => {
    console.log(`Document "${doc.name}" :`, {
      id: doc.id,
      type: doc.type,
      processed: doc.processed,
      hasContent: !!doc.content,
      contentLength: doc.content?.length || 0
    });
  });
  
  const { 
    currentConversation, 
    createConversationWithDocument, 
    linkDocument 
  } = useConversationStore();
  
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      console.log("📌 MindmapModal ouvert, chargement des données...");
      fetchFolders();
      fetchAllDocuments();
    }
  }, [isOpen, fetchFolders, fetchAllDocuments]);

  useEffect(() => {
    if (!isOpen || !svgRef.current || !folders || !documents) return;

    console.log("📌 Initialisation de la mindmap...");
    console.log("📌 Nombre de dossiers :", folders.length);
    console.log("📌 Nombre de documents :", documents.length);

    d3.select(svgRef.current).selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const container = svg.append('g');
    containerRef.current = container.node();

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        container.attr('transform', event.transform.toString());
        setZoom(event.transform.k);
      });

    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior);

    const initialTransform = d3.zoomIdentity
      .translate(centerX, centerY)
      .scale(0.6);
    svg.call(zoomBehavior.transform, initialTransform);

    const nodes: Node[] = [];
    const links: Link[] = [];

    console.log("📌 Création des nœuds...");

    // Nœud racine
    const rootNode: Node = {
      id: 'root',
      name: 'IRSST',
      type: 'folder',
      level: 0,
      color: COLORS.root,
      x: 0,
      y: 0,
      fx: 0,
      fy: 0
    };
    nodes.push(rootNode);

    // Organisation des dossiers par parent
    const foldersByParent = new Map<string | null, typeof folders>();
    folders.forEach(folder => {
      const parentId = folder.parent_id || 'root';
      const parentFolders = foldersByParent.get(parentId) || [];
      parentFolders.push(folder);
      foldersByParent.set(parentId, parentFolders);
    });

    // Fonction récursive pour ajouter les nœuds des dossiers
    const addFolderNodes = (parentId: string | null, level: number, angleOffset: number, totalAngle: number) => {
      const childFolders = foldersByParent.get(parentId) || [];
      const angleStep = totalAngle / (childFolders.length || 1);
      
      childFolders.forEach((folder, index) => {
        const angle = angleOffset + (index * angleStep);
        const radius = level * 300;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        const node: Node = {
          id: folder.id,
          name: folder.name,
          type: 'folder',
          level,
          parentId: parentId === 'root' ? 'root' : parentId,
          color: COLORS.folder.primary,
          fx: x,
          fy: y
        };
        nodes.push(node);
        links.push({
          source: parentId || 'root',
          target: folder.id
        });

        const childAngleRange = angleStep * 0.8;
        addFolderNodes(folder.id, level + 1, angle - childAngleRange/2, childAngleRange);
      });
    };

    addFolderNodes('root', 1, -Math.PI/2, Math.PI * 2);

    // Ajout des nœuds pour les documents
    console.log("📌 Ajout des nœuds de documents...");
    documents.forEach((doc, index) => {
      if (!doc.folder_id) return;
      
      const parentFolder = nodes.find(n => n.id === doc.folder_id);
      if (!parentFolder) return;

      const docsInFolder = documents.filter(d => d.folder_id === doc.folder_id).length;
      const angleStep = (Math.PI * 2) / docsInFolder;
      const angle = index * angleStep;
      const radius = 150;
      
      const node: Node = {
        id: doc.id,
        name: doc.name,
        type: 'document',
        docType: doc.type,
        level: parentFolder.level + 1,
        parentId: doc.folder_id,
        color: selectedDocuments.includes(doc.id) ? COLORS.document.selected : 
               doc.processed ? COLORS.document.processed : COLORS.document.unprocessed,
        processed: doc.processed,
        fx: parentFolder.fx! + Math.cos(angle) * radius,
        fy: parentFolder.fy! + Math.sin(angle) * radius
      };
      nodes.push(node);
      links.push({
        source: doc.folder_id,
        target: doc.id
      });
    });

    console.log("📌 Nœuds générés pour la mindmap :", nodes);

    // Création des liens
    const linkGroup = container.append('g')
      .attr('class', 'links');

    const nodeGroup = container.append('g')
      .attr('class', 'nodes');

    const link = linkGroup
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', COLORS.link.default)
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0);

    const node = nodeGroup
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('opacity', 0)
      .call(d3.drag<any, Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Création des cercles pour chaque nœud
    node.append('circle')
      .attr('r', (d: Node) => d.type === 'folder' ? 50 : 40)
      .attr('fill', (d: Node) => d.color || '#fff')
      .attr('stroke', (d: Node) => d.type === 'document' ? COLORS.link.default : 'none')
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(3px 3px 2px rgba(0,0,0,0.2))');

    // Ajout du texte avec word wrapping
    const textElements = node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', (d: Node) => {
        if (d.type === 'document') {
          return selectedDocuments.includes(d.id) ? '#fff' : '#333';
        }
        return '#fff';
      })
      .attr('class', 'mindmap-node-text')
      .style('font-size', (d: Node) => {
        const nameLength = d.name.length;
        return nameLength > 20 ? '10px' : nameLength > 15 ? '12px' : '14px';
      });

    // Word wrapping
    textElements.each(function(d: Node) {
      const text = d3.select(this);
      const words = d.name.split(/\s+/);
      const lineHeight = 1.2;
      const y = 0;
      let line: string[] = [];
      let lineNumber = 0;
      const maxWidth = d.type === 'folder' ? 90 : 70;

      let tspan = text.append('tspan')
        .attr('x', 0)
        .attr('y', y)
        .attr('dy', '0em');

      words.forEach(word => {
        line.push(word);
        tspan.text(line.join(' '));

        if ((tspan.node()?.getComputedTextLength() || 0) > maxWidth) {
          line.pop();
          tspan.text(line.join(' '));
          line = [word];
          tspan = text.append('tspan')
            .attr('x', 0)
            .attr('y', y)
            .attr('dy', `${++lineNumber * lineHeight}em`)
            .text(word);
        }
      });

      // Centrage du bloc de texte
      const height = (lineNumber * lineHeight) / 2;
      text.selectAll('tspan')
        .attr('dy', (_, i) => `${(i * lineHeight) - height}em`);
    });

    // Ajout des tooltips
    node.append('title')
      .text((d: Node) => d.name);

    // Ajout des indicateurs de sélection
    node.filter((d: Node) => d.type === 'document' && selectedDocuments.includes(d.id))
      .append('circle')
      .attr('r', 12)
      .attr('cx', 30)
      .attr('cy', -30)
      .attr('fill', COLORS.document.selected)
      .attr('stroke', 'white')
      .attr('stroke-width', 2);

    node.filter((d: Node) => d.type === 'document' && selectedDocuments.includes(d.id))
      .append('path')
      .attr('d', 'M 27 -30 L 29 -28 L 33 -32')
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .attr('fill', 'none');

    // Gestionnaire de clic sur les nœuds
    node.on('click', async (event: MouseEvent, d: Node) => {
      if (d.type === 'document' && d.processed) {
        const doc = documents.find(doc => doc.id === d.id);
        if (doc) {
          if (selectedDocuments.includes(d.id)) {
            unselectDocument(d.id);
          } else {
            selectDocument(d.id);
          }
          const nodeSelection = d3.select(event.currentTarget);
          nodeSelection.select('circle').attr('fill', selectedDocuments.includes(d.id) ? COLORS.document.selected : d.processed ? COLORS.document.processed : COLORS.document.unprocessed);
          nodeSelection.select('text').attr('fill', selectedDocuments.includes(d.id) ? '#fff' : '#333');
        }
      }
    });

    // Animations
    link.transition()
      .duration(1000)
      .attr('stroke-opacity', 0.6);

    node.transition()
      .duration(1000)
      .delay((d, i) => i * 50)
      .attr('opacity', 1);

    // Configuration de la simulation de force
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links)
        .id((d: any) => d.id)
        .distance(d => {
          const source = d.source as Node;
          const target = d.target as Node;
          return source.type === 'folder' && target.type === 'folder' ? 300 : 150;
        })
        .strength(0.1))
      .force('charge', d3.forceManyBody()
        .strength(d => d.type === 'folder' ? -1000 : -500)
        .distanceMax(600))
      .force('collide', d3.forceCollide()
        .radius(d => d.type === 'folder' ? 80 : 60)
        .strength(0.7))
      .velocityDecay(0.8)
      .alpha(0.3)
      .alphaDecay(0.01);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.1).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
      setIsDragging(true);
    }

    function dragged(event: any) {
      if (event.subject.id === 'root') return;
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      if (event.subject.id !== 'root') {
        event.subject.fx = null;
        event.subject.fy = null;
      }
      setIsDragging(false);
    }

    return () => {
      simulation.stop();
      svg.on('wheel.zoom', null);
    };
  }, [isOpen, folders, documents, selectedDocuments]);

  const handleZoom = (delta: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    const newScale = Math.max(0.1, Math.min(4, zoom * (1 + delta)));
    
    const newTransform = d3.zoomIdentity
      .translate(centerX, centerY)
      .scale(newScale)
      .translate(-centerX, -centerY);

    svg.transition()
      .duration(300)
      .call(zoomBehaviorRef.current.transform, newTransform);
  };

  const importDocumentsToChat = async () => {
    if (!Array.isArray(selectedDocuments) || selectedDocuments.length === 0 || isProcessing) {
      console.log("⚠️ Import impossible: sélection invalide ou traitement en cours");
      return;
    }

    try {
      console.log("📌 Début de l'import des documents...");
      setIsProcessing(true);
      const selectedDocs = documents.filter(doc => selectedDocuments.includes(doc.id));
      
      if (!currentConversation) {
        console.log("📌 Création d'une nouvelle conversation...");
        await createConversationWithDocument(selectedDocs[0]);
        
        for (let i = 1; i < selectedDocs.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log(`📌 Ajout du document ${i + 1}/${selectedDocs.length}...`);
          await linkDocument(selectedDocs[i].id);
        }
      } else {
        console.log("📌 Ajout à la conversation existante...");
        for (const doc of selectedDocs) {
          await new Promise(resolve => setTimeout(resolve, 500));
          await linkDocument(doc.id);
        }
      }
      
      console.log("✅ Import terminé avec succès");
      clearSelectedDocuments();
      onClose();
    } catch (error) {
      console.error("🚨 Erreur lors de l'import :", error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  if (loading) {
    console.log("⏳ Chargement en cours...");
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 text-center">
          <Loader2 className="w-8 h-8 text-[#f15922] animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement de la mindmap...</p>
        </div>
      </div>
    );
  }

  if (error) {
    console.error("🚨 Erreur :", error);
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    console.log("ℹ️ Aucun document disponible");
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl w-[90vw] h-[80vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-xl font-medium text-gray-900">Mindmap des documents</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                Aucun document disponible
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">
                Veuillez ajouter des documents à votre bibliothèque pour les visualiser dans la mindmap.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[90vw] h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-medium text-gray-900">Mindmap des documents</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleZoom(-0.1)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
            >
              <ZoomOut size={20} />
            </button>
            <button
              onClick={() => handleZoom(0.1)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
            >
              <ZoomIn size={20} />
            </button>
            {selectedDocuments.length > 0 && (
              <button
                onClick={importDocumentsToChat}
                disabled={isProcessing}
                className="ml-2 px-4 py-2 bg-[#f15922] text-white rounded-lg flex items-center gap-2 hover:bg-[#f15922]/90 transition-colors disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Envoi en cours...</span>
                  </>
                ) : (
                  <>
                    <MessageSquare size={18} />
                    <span>Envoyer {selectedDocuments.length} document{selectedDocuments.length > 1 ? 's' : ''} au chat</span>
                  </>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex-1 relative">
          <svg
            ref={svgRef}
            className="w-full h-full"
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          />
        </div>
      </div>
    </div>
  );
}