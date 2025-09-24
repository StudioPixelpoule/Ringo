/**
 * Module de traitement des fichiers Markdown pour Edge Functions
 * Version simplifiée sans dépendances externes
 */

export interface MarkdownMetadata {
  title?: string;
  author?: string;
  date?: string;
  tags?: string[];
  [key: string]: any;
}

export interface MarkdownStructure {
  headings: {
    level: number;
    text: string;
  }[];
  codeBlocks: number;
  links: number;
  images: number;
  tables: number;
  lists: number;
}

/**
 * Extraire les métadonnées YAML du frontmatter
 */
function extractFrontmatter(content: string): {
  metadata: MarkdownMetadata;
  content: string;
} {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { metadata: {}, content };
  }

  const yamlContent = match[1];
  const cleanContent = content.replace(frontmatterRegex, '');
  
  // Parser le YAML simple
  const metadata: MarkdownMetadata = {};
  const lines = yamlContent.split('\n');
  
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      
      // Supprimer les guillemets
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      // Détecter les tableaux simples
      if (value.startsWith('[') && value.endsWith(']')) {
        metadata[key] = value.slice(1, -1).split(',').map(v => v.trim());
      } else {
        metadata[key] = value;
      }
    }
  }
  
  return { metadata, content: cleanContent };
}

/**
 * Analyser la structure du document Markdown (version simplifiée)
 */
function analyzeStructure(content: string): MarkdownStructure {
  const lines = content.split('\n');
  const structure: MarkdownStructure = {
    headings: [],
    codeBlocks: 0,
    links: 0,
    images: 0,
    tables: 0,
    lists: 0
  };

  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Détection des blocs de code
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        structure.codeBlocks++;
      } else {
        inCodeBlock = false;
      }
      continue;
    }

    if (inCodeBlock) continue;

    // Détection des titres
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      structure.headings.push({
        level: headingMatch[1].length,
        text: headingMatch[2].trim()
      });
    }

    // Comptage des liens
    const linkMatches = line.match(/\[([^\]]+)\]\(([^)]+)\)/g);
    if (linkMatches) {
      structure.links += linkMatches.length;
    }

    // Comptage des images
    const imageMatches = line.match(/!\[([^\]]*)\]\(([^)]+)\)/g);
    if (imageMatches) {
      structure.images += imageMatches.length;
    }

    // Détection des tableaux
    if (line.includes('|') && i > 0 && lines[i - 1].includes('|')) {
      const separatorMatch = line.match(/^\|?\s*:?-+:?\s*\|/);
      if (separatorMatch) {
        structure.tables++;
      }
    }

    // Détection des listes
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      structure.lists++;
    }
  }

  return structure;
}

/**
 * Convertir le Markdown en texte brut
 */
function markdownToPlainText(content: string): string {
  let text = content;

  // Supprimer les blocs de code
  text = text.replace(/```[\s\S]*?```/g, '[CODE BLOCK]');
  text = text.replace(/`[^`]+`/g, (match) => match.slice(1, -1));

  // Convertir les titres
  text = text.replace(/^#{1,6}\s+/gm, '');

  // Supprimer les liens mais garder le texte
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Supprimer les images
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

  // Supprimer les caractères de formatage
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2'); // Gras
  text = text.replace(/(\*|_)(.*?)\1/g, '$2'); // Italique
  text = text.replace(/~~(.*?)~~/g, '$1'); // Barré

  // Supprimer les séparateurs horizontaux
  text = text.replace(/^[-*_]{3,}$/gm, '');

  // Nettoyer les listes
  text = text.replace(/^\s*[-*+]\s+/gm, '• ');
  text = text.replace(/^\s*\d+\.\s+/gm, '');

  // Supprimer les citations
  text = text.replace(/^>\s+/gm, '');

  // Nettoyer les espaces multiples
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');

  return text.trim();
}

/**
 * Traiter un fichier Markdown
 */
export async function processMarkdownDocument(file: File): Promise<any> {
  console.log('[Markdown Processing] Starting processing:', file.name);
  
  const text = await file.text();
  
  // Extraire le frontmatter et les métadonnées
  const { metadata, content } = extractFrontmatter(text);
  
  // Si pas de titre dans les métadonnées, essayer de le trouver dans le premier H1
  if (!metadata.title) {
    const firstH1 = content.match(/^#\s+(.+)$/m);
    if (firstH1) {
      metadata.title = firstH1[1].trim();
    }
  }

  // Analyser la structure
  const structure = analyzeStructure(content);

  // Convertir en texte brut
  const plainText = markdownToPlainText(content);

  // Formater pour le stockage
  let formatted = '=== DOCUMENT MARKDOWN ===\n\n';

  // Ajouter les métadonnées
  if (Object.keys(metadata).length > 0) {
    formatted += '📋 MÉTADONNÉES:\n';
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== undefined && value !== null) {
        formatted += `  • ${key}: ${Array.isArray(value) ? value.join(', ') : value}\n`;
      }
    }
    formatted += '\n';
  }

  // Ajouter le résumé de structure
  formatted += '📊 STRUCTURE:\n';
  formatted += `  • ${structure.headings.length} titre(s)\n`;
  
  if (structure.headings.length > 0) {
    formatted += '    Hiérarchie:\n';
    structure.headings.slice(0, 10).forEach(h => {
      const indent = '    ' + '  '.repeat(h.level - 1);
      formatted += `${indent}${h.level === 1 ? '📍' : h.level === 2 ? '▸' : '◦'} ${h.text}\n`;
    });
  }

  if (structure.codeBlocks > 0) {
    formatted += `  • ${structure.codeBlocks} bloc(s) de code\n`;
  }
  if (structure.links > 0) {
    formatted += `  • ${structure.links} lien(s)\n`;
  }
  if (structure.images > 0) {
    formatted += `  • ${structure.images} image(s)\n`;
  }
  if (structure.tables > 0) {
    formatted += `  • ${structure.tables} tableau(x)\n`;
  }
  if (structure.lists > 0) {
    formatted += `  • ${structure.lists} élément(s) de liste\n`;
  }

  formatted += '\n=== CONTENU ===\n\n';
  formatted += plainText;
  formatted += '\n\n=== FIN DU DOCUMENT ===';

  return {
    content: formatted,
    metadata: {
      fileName: file.name,
      fileType: 'text/markdown',
      language: 'unknown',
      title: metadata.title || file.name,
      ...metadata,
      structure: {
        headingCount: structure.headings.length,
        codeBlockCount: structure.codeBlocks,
        linkCount: structure.links,
        imageCount: structure.images,
        tableCount: structure.tables
      }
    },
    confidence: 1,
    processingDate: new Date().toISOString()
  };
}
