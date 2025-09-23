/**
 * Utilitaires pour la gestion sécurisée du JSON
 */

/**
 * Parse du JSON avec gestion d'erreur robuste
 */
export function safeJsonParse(text: string): { data: any; error?: string } {
  // Vérifier si le texte est vide
  if (!text || text.trim().length === 0) {
    return { 
      data: null, 
      error: 'Le contenu est vide' 
    };
  }

  // Première tentative de parsing direct
  try {
    const data = JSON.parse(text);
    return { data };
  } catch (firstError) {
    console.warn('Première tentative de parsing JSON échouée:', firstError);
  }

  // Nettoyer le texte et réessayer
  let cleanedText = text;
  
  // Supprimer le BOM (Byte Order Mark) si présent
  if (cleanedText.charCodeAt(0) === 0xFEFF) {
    cleanedText = cleanedText.substring(1);
  }
  
  // Supprimer les espaces invisibles et caractères de contrôle
  cleanedText = cleanedText
    .trim()
    .replace(/^\uFEFF/, '') // BOM alternatif
    .replace(/\u0000/g, '') // Null characters
    .replace(/[\u0001-\u001F]/g, ''); // Caractères de contrôle
  
  // Deuxième tentative avec le texte nettoyé
  try {
    const data = JSON.parse(cleanedText);
    return { data };
  } catch (secondError) {
    console.error('Deuxième tentative de parsing JSON échouée:', secondError);
  }

  // Si c'est peut-être du JSONP, essayer de l'extraire
  const jsonpMatch = cleanedText.match(/^[^(]*\((.*)\)[^)]*$/);
  if (jsonpMatch) {
    try {
      const data = JSON.parse(jsonpMatch[1]);
      return { data };
    } catch (jsonpError) {
      console.warn('Tentative JSONP échouée:', jsonpError);
    }
  }

  // Vérifier si c'est peut-être du JSON avec des commentaires
  const jsonWithoutComments = cleanedText
    .replace(/\/\*[\s\S]*?\*\//g, '') // Commentaires multi-lignes
    .replace(/\/\/.*/g, ''); // Commentaires single-ligne
  
  if (jsonWithoutComments !== cleanedText) {
    try {
      const data = JSON.parse(jsonWithoutComments);
      return { data };
    } catch (noCommentsError) {
      console.warn('Tentative sans commentaires échouée:', noCommentsError);
    }
  }

  // En dernier recours, retourner une structure avec l'erreur
  return {
    data: {
      error: 'JSON_PARSE_ERROR',
      rawContent: text.substring(0, 5000),
      message: 'Impossible de parser le fichier JSON'
    },
    error: 'Le fichier ne contient pas de JSON valide'
  };
}

/**
 * Stringify JSON de manière sécurisée avec gestion des références circulaires
 */
export function safeJsonStringify(obj: any, space?: number): string {
  const seen = new WeakSet();
  
  try {
    return JSON.stringify(obj, (key, value) => {
      // Gérer les références circulaires
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      
      // Gérer les fonctions
      if (typeof value === 'function') {
        return '[Function]';
      }
      
      // Gérer les undefined
      if (value === undefined) {
        return null;
      }
      
      return value;
    }, space);
  } catch (error) {
    console.error('Erreur lors du stringify:', error);
    return '{}';
  }
}

/**
 * Détecter le type de structure JSON
 */
export function detectJsonStructure(data: any): {
  type: 'array' | 'object' | 'primitive' | 'unknown';
  complexity: 'simple' | 'nested' | 'complex';
  depth: number;
} {
  if (data === null || data === undefined) {
    return { type: 'unknown', complexity: 'simple', depth: 0 };
  }

  if (Array.isArray(data)) {
    const depth = getMaxDepth(data);
    return {
      type: 'array',
      complexity: depth > 2 ? 'complex' : depth > 1 ? 'nested' : 'simple',
      depth
    };
  }

  if (typeof data === 'object') {
    const depth = getMaxDepth(data);
    return {
      type: 'object',
      complexity: depth > 3 ? 'complex' : depth > 1 ? 'nested' : 'simple',
      depth
    };
  }

  return { type: 'primitive', complexity: 'simple', depth: 0 };
}

/**
 * Calculer la profondeur maximale d'un objet
 */
function getMaxDepth(obj: any, currentDepth = 0): number {
  if (currentDepth > 10) return 10; // Limite pour éviter la récursion infinie
  
  if (obj === null || typeof obj !== 'object') {
    return currentDepth;
  }

  let maxDepth = currentDepth;
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const depth = getMaxDepth(obj[key], currentDepth + 1);
      maxDepth = Math.max(maxDepth, depth);
    }
  }

  return maxDepth;
}

/**
 * Formater un objet JSON pour l'affichage avec limite de taille
 */
export function formatJsonForDisplay(data: any, maxLength = 50000): {
  formatted: string;
  truncated: boolean;
  originalSize: number;
} {
  const fullString = safeJsonStringify(data, 2);
  const originalSize = fullString.length;
  
  if (originalSize <= maxLength) {
    return {
      formatted: fullString,
      truncated: false,
      originalSize
    };
  }

  // Tronquer intelligemment
  const truncated = fullString.substring(0, maxLength);
  const lastNewline = truncated.lastIndexOf('\n');
  
  return {
    formatted: truncated.substring(0, lastNewline > 0 ? lastNewline : maxLength),
    truncated: true,
    originalSize
  };
}
