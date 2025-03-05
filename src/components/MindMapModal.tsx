import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import * as d3 from 'd3';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { useDocumentStore, Document, Folder as FolderType } from '../lib/documentStore';

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
  document: '#FFFFFF',
  link: '#106f69',
  text: {
    light: '#FFFFFF',
    dark: '#333333',
  },
  shadow: {
    light: 'rgba(255, 255, 255, 0.2)',
    dark: 'rgba(0, 0, 0, 0.1)',
  }
};

export function MindmapModal({ isOpen, onClose, onSelectDocument }: MindmapModalProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { folders, documents, fetchFolders, fetchAllDocuments } = useDocumentStore();
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

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

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Create definitions for filters and markers
    const defs = svg.append('defs');
    
    // Add shadow filter
    const filter = defs.append('filter')
      .attr('id', 'shadow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    filter.append('feGaussianBlur')
      .attr('in', 'SourceAlpha')
      .attr('stdDeviation', 4)
      .attr('result', 'blur');

    filter.append('feOffset')
      .attr('in', 'blur')
      .attr('dx', 3)
      .attr('dy', 3)
      .attr('result', 'offsetBlur');

    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode')
      .attr('in', 'offsetBlur');
    feMerge.append('feMergeNode')
      .attr('in', 'SourceGraphic');

    // Create nodes data
    const nodes: Node[] = [];
    const links: Link[] = [];

    // Add root node
    const rootNode: Node = {
      id: 'root',
      name: 'IRSST',
      type: 'folder',
      level: 0,
      color: COLORS.root,
    };
    nodes.push(rootNode);

    // Add folder nodes
    folders.forEach(folder => {
      const node: Node = {
        id: folder.id,
        name: folder.name,
        type: 'folder',
        level: folder.parent_id ? 1 : 0,
        parentId: folder.parent_id || 'root',
        color: COLORS.folder.primary,
      };
      nodes.push(node);
      
      // Only create link if parent exists
      const parentExists = folder.parent_id ? 
        folders.some(f => f.id === folder.parent_id) : 
        true; // Root parent always exists
      
      if (parentExists) {
        links.push({
          source: folder.parent_id || 'root',
          target: folder.id,
        });
      }
    });

    // Add document nodes
    documents.forEach(doc => {
      if (!doc.folder_id) return; // Skip documents without folder
      
      // Only add document if its folder exists
      const folderExists = folders.some(f => f.id === doc.folder_id);
      if (!folderExists) return;

      const node: Node = {
        id: doc.id,
        name: doc.name,
        type: 'document',
        docType: doc.type,
        level: 2,
        parentId: doc.folder_id,
        color: COLORS.document,
      };
      nodes.push(node);
      links.push({
        source: doc.folder_id,
        target: doc.id,
      });
    });

    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-1500))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(60));

    // Create container for zoom
    const container = svg.append('g');

    // Create zoom behavior
    const zoomBehavior = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
        setZoom(event.transform.k);
      });

    svg.call(zoomBehavior as any);

    // Draw links first (to be behind nodes)
    const link = container.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', COLORS.link)
      .attr('stroke-width', 3)
      .attr('stroke-opacity', 0.8);

    // Create node groups
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
      .attr('stroke', d => d.type === 'document' ? COLORS.link : 'none')
      .attr('stroke-width', 2)
      .attr('filter', 'url(#shadow)');

    // Add text directly in circles
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', d => d.type === 'document' ? COLORS.text.dark : COLORS.text.light)
      .attr('font-size', d => {
        const nameLength = d.name.length;
        return nameLength > 20 ? '10px' : nameLength > 15 ? '12px' : '14px';
      })
      .each(function(d) {
        const text = d3.select(this);
        const words = d.name.split(/\s+/);
        const lines: string[] = [];
        let line: string[] = [];
        
        words.forEach(word => {
          const testLine = [...line, word];
          if (testLine.join(' ').length > 15) {
            if (line.length > 0) lines.push(line.join(' '));
            line = [word];
          } else {
            line = testLine;
          }
        });
        if (line.length > 0) lines.push(line.join(' '));
        
        lines.forEach((l, i) => {
          text.append('tspan')
            .attr('x', 0)
            .attr('dy', i === 0 ? -((lines.length - 1) * 12) / 2 : 12)
            .text(l);
        });
      });

    // Add click handlers
    node.on('click', (event, d: Node) => {
      if (d.type === 'document' && onSelectDocument) {
        const doc = documents.find(doc => doc.id === d.id);
        if (doc) onSelectDocument(doc);
      }
    });

    // Update positions on simulation tick
    simulation.on('tick', () => {
      // Update link positions
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      // Update node positions
      node.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Drag functions
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
      setIsDragging(true);
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
      setIsDragging(false);
    }

    return () => {
      simulation.stop();
    };
  }, [isOpen, folders, documents, onSelectDocument]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[90vw] h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-medium text-gray-900">Mindmap des documents</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(z => Math.max(0.1, z - 0.1))}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
            >
              <ZoomOut size={20} />
            </button>
            <button
              onClick={() => setZoom(z => Math.min(4, z + 0.1))}
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