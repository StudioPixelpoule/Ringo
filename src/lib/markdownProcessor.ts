/**
 * Module de traitement des fichiers Markdown
 * Support complet avec extraction de structure, métadonnées et formatage
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
    line: number;
  }[];
  codeBlocks: {
    language: string;
    content: string;
    line: number;
  }[];
  links: {
    text: string;
    url: string;
    line: number;
  }[];
  images: {
    alt: string;
    url: string;
    line: number;
  }[];
  tables: number;
  lists: {
    ordered: number;
    unordered: number;
  };
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
  
  // Parser le YAML simple (sans dépendance externe pour rester léger)
  const metadata: MarkdownMetadata = {};
  const lines = yamlContent.split('\n');
  
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      
      // Supprimer les guillemets si présents
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
 * Analyser la structure du document Markdown
 */
function analyzeStructure(content: string): MarkdownStructure {
  const lines = content.split('\n');
  const structure: MarkdownStructure = {
    headings: [],
    codeBlocks: [],
    links: [],
    images: [],
    tables: 0,
    lists: { ordered: 0, unordered: 0 }
  };

  let inCodeBlock = false;
  let codeBlockStart = 0;
  let codeBlockLanguage = '';
  let codeBlockContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Détection des blocs de code
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockStart = i;
        codeBlockLanguage = line.slice(3).trim();
        codeBlockContent = [];
      } else {
        structure.codeBlocks.push({
          language: codeBlockLanguage || 'plain',
          content: codeBlockContent.join('\n'),
          line: codeBlockStart
        });
        inCodeBlock = false;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Détection des titres
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      structure.headings.push({
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
        line: i
      });
    }

    // Détection des liens
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(line)) !== null) {
      structure.links.push({
        text: linkMatch[1],
        url: linkMatch[2],
        line: i
      });
    }

    // Détection des images
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let imageMatch;
    while ((imageMatch = imageRegex.exec(line)) !== null) {
      structure.images.push({
        alt: imageMatch[1] || 'Image',
        url: imageMatch[2],
        line: i
      });
    }

    // Détection des tableaux
    if (line.includes('|') && i > 0 && lines[i - 1].includes('|')) {
      const separatorMatch = line.match(/^\|?\s*:?-+:?\s*\|/);
      if (separatorMatch) {
        structure.tables++;
      }
    }

    // Détection des listes
    if (/^\s*[-*+]\s+/.test(line)) {
      structure.lists.unordered++;
    } else if (/^\s*\d+\.\s+/.test(line)) {
      structure.lists.ordered++;
    }
  }

  return structure;
}

/**
 * Convertir le Markdown en texte brut pour l'indexation
 */
function markdownToPlainText(content: string): string {
  let text = content;

  // Supprimer les blocs de code
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`[^`]+`/g, (match) => match.slice(1, -1));

  // Convertir les titres
  text = text.replace(/^#{1,6}\s+/gm, '');

  // Supprimer les liens mais garder le texte
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Supprimer les images
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

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
 * Formater le contenu pour l'affichage structuré
 */
function formatForDisplay(
  content: string, 
  metadata: MarkdownMetadata, 
  structure: MarkdownStructure
): string {
  let formatted = '=== DOCUMENT MARKDOWN ===\n\n';

  // Ajouter les métadonnées si présentes
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
  formatted += '📊 STRUCTURE DU DOCUMENT:\n';
  formatted += `  • ${structure.headings.length} titre(s)\n`;
  
  if (structure.headings.length > 0) {
    formatted += '    Hiérarchie:\n';
    const maxHeadings = 10;
    structure.headings.slice(0, maxHeadings).forEach(h => {
      const indent = '    ' + '  '.repeat(h.level - 1);
      formatted += `${indent}${h.level === 1 ? '📍' : h.level === 2 ? '▸' : '◦'} ${h.text}\n`;
    });
    if (structure.headings.length > maxHeadings) {
      formatted += `    ... et ${structure.headings.length - maxHeadings} autres titres\n`;
    }
  }

  if (structure.codeBlocks.length > 0) {
    formatted += `  • ${structure.codeBlocks.length} bloc(s) de code`;
    const languages = [...new Set(structure.codeBlocks.map(b => b.language))];
    formatted += ` (${languages.join(', ')})\n`;
  }

  if (structure.links.length > 0) {
    formatted += `  • ${structure.links.length} lien(s)\n`;
  }

  if (structure.images.length > 0) {
    formatted += `  • ${structure.images.length} image(s)\n`;
  }

  if (structure.tables > 0) {
    formatted += `  • ${structure.tables} tableau(x)\n`;
  }

  if (structure.lists.ordered + structure.lists.unordered > 0) {
    formatted += `  • ${structure.lists.ordered + structure.lists.unordered} élément(s) de liste\n`;
  }

  formatted += '\n=== CONTENU ===\n\n';
  
  // Ajouter le contenu converti en texte brut
  const plainText = markdownToPlainText(content);
  formatted += plainText;

  formatted += '\n\n=== FIN DU DOCUMENT ===';

  return formatted;
}

/**
 * Traiter un fichier Markdown complet
 */
export async function processMarkdownFile(
  file: File,
  options?: { includeStructure?: boolean }
): Promise<{
  content: string;
  metadata: MarkdownMetadata;
  structure: MarkdownStructure;
  plainText: string;
}> {
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

  // Formater pour l'affichage
  const formatted = formatForDisplay(content, metadata, structure);

  return {
    content: formatted,
    metadata,
    structure,
    plainText
  };
}

/**
 * Détecter si un fichier est un fichier Markdown
 */
export function isMarkdownFile(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const markdownExtensions = ['md', 'markdown', 'mdown', 'mkd', 'mdx'];
  
  // Vérifier l'extension
  if (markdownExtensions.includes(extension || '')) {
    return true;
  }

  // Vérifier le type MIME
  const markdownMimeTypes = [
    'text/markdown',
    'text/x-markdown',
    'text/plain' // Parfois les .md sont détectés comme text/plain
  ];

  if (markdownMimeTypes.includes(file.type.toLowerCase())) {
    // Pour text/plain, vérifier aussi l'extension
    if (file.type === 'text/plain') {
      return markdownExtensions.includes(extension || '');
    }
    return true;
  }

  return false;
}
