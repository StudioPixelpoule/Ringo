// Utilitaire pour nettoyer et corriger le formatage Markdown
export function cleanMarkdownFormatting(content: string): string {
  if (!content) return '';
  
  // Corriger les titres collés au texte (ex: "texte### Titre" → "texte\n\n### Titre")
  content = content.replace(/([^\n#])(\#{1,6}\s)/g, '$1\n\n$2');
  
  // Corriger les titres sans espace après les # (ex: "###Titre" → "### Titre")
  content = content.replace(/^(\#{1,6})([^\s#])/gm, '$1 $2');
  content = content.replace(/\n(\#{1,6})([^\s#])/g, '\n$1 $2');
  
  // Ajouter une ligne vide après les titres s'il n'y en a pas
  content = content.replace(/^(\#{1,6}\s.+)$/gm, (match, p1, offset, string) => {
    const nextChar = string[offset + match.length];
    const nextNextChar = string[offset + match.length + 1];
    if (nextChar && nextChar !== '\n') {
      return p1 + '\n';
    } else if (nextChar === '\n' && nextNextChar && nextNextChar !== '\n') {
      return p1 + '\n';
    }
    return match;
  });
  
  // Corriger les listes mal formatées (ex: "-Item" → "- Item")
  content = content.replace(/^(\s*)([-*+])([^\s])/gm, '$1$2 $3');
  content = content.replace(/^(\s*)(\d+\.)([^\s])/gm, '$1$2 $3');
  
  // S'assurer qu'il y a des lignes vides autour des blocs de code
  content = content.replace(/([^\n])\n```/g, '$1\n\n```');
  content = content.replace(/```\n([^\n])/g, '```\n\n$1');
  
  // S'assurer que les paragraphes sont bien séparés
  content = content.replace(/([.!?])\n([A-ZÀ-ÿ])/g, '$1\n\n$2');
  
  // Corriger les espaces multiples (mais garder les doubles espaces en fin de ligne pour les sauts)
  content = content.replace(/([^\n])  +([^\n])/g, '$1 $2');
  
  // Nettoyer les lignes vides multiples (max 2 lignes vides consécutives)
  content = content.replace(/\n{3,}/g, '\n\n');
  
  return content.trim();
}

// Fonction pour vérifier et corriger la numérotation
export function fixNumbering(content: string): string {
  const lines = content.split('\n');
  const numberingState = {
    section: 0,
    subsections: new Map<number, number>()
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Détecter les sections principales (## X. ou ## X)
    const sectionMatch = line.match(/^##\s+(\d+\.?\s*)?(.+)$/);
    if (sectionMatch) {
      numberingState.section++;
      numberingState.subsections.clear();
      const title = sectionMatch[2].replace(/^\d+\.?\s*/, '').trim();
      lines[i] = `## ${numberingState.section}. ${title}`;
    }
    
    // Détecter les sous-sections (### X.X ou ### X)
    const subsectionMatch = line.match(/^###\s+(\d+\.?\d*\.?\s*)?(.+)$/);
    if (subsectionMatch) {
      const currentSubsection = (numberingState.subsections.get(numberingState.section) || 0) + 1;
      numberingState.subsections.set(numberingState.section, currentSubsection);
      const title = subsectionMatch[2].replace(/^\d+\.?\d*\.?\s*/, '').trim();
      lines[i] = `### ${numberingState.section}.${currentSubsection} ${title}`;
    }
  }
  
  return lines.join('\n');
}

// Fonction combinée pour un nettoyage complet
export function formatMarkdownContent(content: string, fixNumbers: boolean = false): string {
  let formatted = cleanMarkdownFormatting(content);
  
  if (fixNumbers) {
    formatted = fixNumbering(formatted);
  }
  
  return formatted;
} 