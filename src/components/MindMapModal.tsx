import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import * as d3 from 'd3';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { useDocumentStore, Document, Folder as FolderType } from '../lib/documentStore';
import { useConversationStore } from '../lib/conversationStore';

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

interface MindmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDocument?: (document: Document) => void;
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
  },
  link: {
    default: '#106f69',
  },
  text: {
    light: '#FFFFFF',
    dark: '#333333',
  },
  shadow: {
    light: 'rgba(255, 255, 255, 0.2)',
    dark: 'rgba(0, 0, 0, 0.1)',
  }
};

export function MindmapModal({ isOpen, onClose }: MindmapModalProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<SVGGElement | null>(null);
  const { folders, documents, fetchFolders, fetchAllDocuments } = useDocumentStore();
  const { currentConversation, createConversationWithDocument } = useConversationStore();
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);

  useEffect(() => {
    if (isOpen) {
      fetchFolders();
      fetchAllDocuments();
    }
  }, [isOpen, fetchFolders, fetchAllDocuments]);

  useEffect(() => {
    if (!isOpen || !svgRef.current || !folders || !documents) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Create container for zoom
    const container = svg.append('g');
    containerRef.current = container.node();

    // Create zoom behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        container.attr('transform', event.transform.toString());
        setZoom(event.transform.k);
        setTransform(event.transform);
      });

    svg.call(zoomBehavior);

    // Center the view initially
    const initialTransform = d3.zoomIdentity
      .translate(centerX, centerY)
      .scale(0.8);
    svg.call(zoomBehavior.transform, initialTransform);

    // Create nodes and links data
    const nodes: Node[] = [];
    const links: Link[] = [];

    // Add root node at center
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

    // Add folder nodes
    folders.forEach((folder) => {
      const node: Node = {
        id: folder.id,
        name: folder.name,
        type: 'folder',
        level: folder.parent_id ? 1 : 0,
        parentId: folder.parent_id || 'root',
        color: COLORS.folder.primary
      };
      nodes.push(node);
      links.push({
        source: folder.parent_id || 'root',
        target: folder.id
      });
    });

    // Add document nodes
    documents.forEach((doc) => {
      if (!doc.folder_id) return;
      
      const node: Node = {
        id: doc.id,
        name: doc.name,
        type: 'document',
        docType: doc.type,
        level: 2,
        parentId: doc.folder_id,
        color: doc.processed ? COLORS.document.processed : COLORS.document.unprocessed,
        processed: doc.processed
      };
      nodes.push(node);
      links.push({
        source: doc.folder_id,
        target: doc.id
      });
    });

    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links)
        .id((d: any) => d.id)
        .distance(d => {
          const source = d.source as Node;
          const target = d.target as Node;
          return source.type === 'folder' && target.type === 'folder' ? 200 : 150;
        })
        .strength(0.3))
      .force('charge', d3.forceManyBody()
        .strength(d => d.type === 'folder' ? -800 : -400)
        .distanceMax(350))
      .force('collide', d3.forceCollide()
        .radius(d => d.type === 'folder' ? 60 : 50)
        .strength(0.7))
      .force('radial', d3.forceRadial(
        d => d.type === 'folder' ? (d.parentId === 'root' ? 200 : 300) : 400,
        0,
        0
      ).strength(0.3))
      .velocityDecay(0.6);

    // Create links
    const link = container.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', COLORS.link.default)
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6);

    // Create nodes
    const node = container.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add circles to nodes
    node.append('circle')
      .attr('r', d => d.type === 'folder' ? 50 : 40)
      .attr('fill', d => d.color!)
      .attr('stroke', d => d.type === 'document' ? COLORS.link.default : 'none')
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(3px 3px 2px rgba(0,0,0,0.2))');

    // Add text to nodes
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', d => d.type === 'document' ? COLORS.text.dark : COLORS.text.light)
      .attr('font-size', d => {
        const nameLength = d.name.length;
        return nameLength > 20 ? '10px' : nameLength > 15 ? '12px' : '14px';
      })
      .text(d => d.name);

    // Add click handlers
    node.on('click', async (event, d: Node) => {
      if (d.type === 'document' && d.processed) {
        const doc = documents.find(doc => doc.id === d.id);
        if (doc) {
          if (!currentConversation) {
            await createConversationWithDocument(doc);
          }
          onClose();
        }
      }
    });

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Handle wheel zoom
    svg.on('wheel.zoom', (event: WheelEvent) => {
      event.preventDefault();
      const delta = -event.deltaY * 0.002;
      const newScale = Math.max(0.1, Math.min(4, transform.k * (1 + delta)));
      
      const mouseX = event.offsetX - centerX;
      const mouseY = event.offsetY - centerY;
      
      const newTransform = d3.zoomIdentity
        .translate(
          centerX - (mouseX * newScale - mouseX * transform.k) / transform.k,
          centerY - (mouseY * newScale - mouseY * transform.k) / transform.k
        )
        .scale(newScale);
      
      svg.transition()
        .duration(50)
        .call(zoomBehavior.transform, newTransform);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
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
  }, [isOpen, folders, documents, currentConversation, onClose, createConversationWithDocument]);

  const handleZoom = (delta: number) => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    const newScale = Math.max(0.1, Math.min(4, transform.k * (1 + delta)));
    
    const newTransform = d3.zoomIdentity
      .translate(centerX, centerY)
      .scale(newScale)
      .translate(-centerX, -centerY);

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4]);

    svg.transition()
      .duration(250)
      .call(zoomBehavior.transform, newTransform);
  };

  if (!isOpen) return null;

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
            <button
              onClick={onClose}
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