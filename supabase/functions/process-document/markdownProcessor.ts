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

  // Formater pour l'utilisateur final
  let formatted = '';

  // Titre du document
  if (metadata.title) {
    formatted += `📄 ${metadata.title}\n`;
    formatted += '═'.repeat(Math.min(metadata.title.length + 3, 60)) + '\n\n';
  } else if (structure.headings.length > 0 && structure.headings[0].level === 1) {
    formatted += `📄 ${structure.headings[0].text}\n`;
    formatted += '═'.repeat(Math.min(structure.headings[0].text.length + 3, 60)) + '\n\n';
  }

  // Informations de contexte
  if (metadata.author || metadata.date) {
    if (metadata.author) formatted += `Auteur : ${metadata.author}\n`;
    if (metadata.date) formatted += `Date : ${metadata.date}\n`;
    if (metadata.tags && Array.isArray(metadata.tags)) {
      formatted += `Sujets : ${metadata.tags.join(', ')}\n`;
    }
    formatted += '\n';
  }

  // Plan simplifié si nécessaire
  if (structure.headings.length > 2) {
    formatted += '📑 Plan du document :\n\n';
    const mainSections = structure.headings.filter(h => h.level <= 2);
    mainSections.slice(0, 10).forEach(h => {
      if (h.level === 1) {
        formatted += `• ${h.text}\n`;
      } else if (h.level === 2) {
        formatted += `  ◦ ${h.text}\n`;
      }
    });
    if (mainSections.length > 10) {
      formatted += `  ... et ${mainSections.length - 10} autres sections\n`;
    }
    formatted += '\n';
  }

  // Contenu principal
  formatted += '📝 Contenu :\n\n';
  formatted += plainText;

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
