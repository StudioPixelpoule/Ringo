/**
 * Utilitaires pour la gestion sécurisée du JSON dans les Edge Functions
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
