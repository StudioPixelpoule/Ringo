import { MAX_TOKENS, MAX_SYSTEM_TOKENS, MAX_HISTORY_TOKENS, MAX_RESPONSE_TOKENS } from './constants';

// Estimation des tokens (4 caractères ≈ 1 token)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Interface pour les options de compression
interface CompressionOptions {
  maxTokensPerDoc: number;
  preserveStructure: boolean;
  priorityContent?: string[];
}

// Interface pour les documents compressés
export interface CompressedDocument {
  name: string;
  content: string;
  compressed: boolean;
  originalTokens: number;
  compressedTokens: number;
}

// Fonction principale de compression des documents
export function compressDocuments(
  documents: Array<{ name: string; content: string }>,
  totalDocs: number
): CompressedDocument[] {
  // Calculer le budget de tokens disponible
  const availableTokens = MAX_TOKENS - MAX_SYSTEM_TOKENS - MAX_HISTORY_TOKENS - MAX_RESPONSE_TOKENS;
  const tokensPerDoc = Math.floor(availableTokens / totalDocs);
  
  // Minimum de tokens par document pour garder du contenu significatif
  const MIN_TOKENS_PER_DOC = 5000;
  const allocatedTokensPerDoc = Math.max(MIN_TOKENS_PER_DOC, tokensPerDoc);

  return documents.map(doc => {
    const originalTokens = estimateTokens(doc.content);
    
    // Si le document est déjà dans la limite, pas de compression
    if (originalTokens <= allocatedTokensPerDoc) {
      return {
        name: doc.name,
        content: doc.content,
        compressed: false,
        originalTokens,
        compressedTokens: originalTokens
      };
    }

    // Compression intelligente nécessaire
    const compressedContent = intelligentCompress(
      doc.content,
      allocatedTokensPerDoc,
      {
        maxTokensPerDoc: allocatedTokensPerDoc,
        preserveStructure: true
      }
    );

    return {
      name: doc.name,
      content: compressedContent,
      compressed: true,
      originalTokens,
      compressedTokens: estimateTokens(compressedContent)
    };
  });
}

// Fonction de compression intelligente
function intelligentCompress(
  content: string,
  targetTokens: number,
  options: CompressionOptions
): string {
  // Vérifier et nettoyer le contenu d'entrée
  if (!content || content.length === 0) {
    return '';
  }
  
  // Normalisation complète du contenu
  content = content
    .normalize('NFC') // Normalisation Unicode
    .replace(/\u00A0/g, ' ') // Remplacer les espaces insécables
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Supprimer les caractères invisibles
    .replace(/[\u0080-\u009F]/g, '') // Supprimer les caractères de contrôle
    .replace(/\r\n/g, '\n') // Normaliser les retours à la ligne
    .replace(/\r/g, '\n')
    .replace(/\t/g, '  '); // Remplacer les tabs par des espaces
  
  // Diviser le contenu en sections
  const sections = splitIntoSections(content);
  
  // Calculer l'importance de chaque section
  const scoredSections = sections.map(section => ({
    content: section,
    score: calculateSectionScore(section, options.priorityContent),
    tokens: estimateTokens(section)
  }));

  // Trier par importance décroissante
  scoredSections.sort((a, b) => b.score - a.score);

  // Construire le contenu compressé
  let result = '';
  let currentTokens = 0;
  const summaryThreshold = targetTokens * 0.8; // Garder 20% pour les résumés
  const addedSections = new Set<string>(); // Pour éviter les doublons

  for (const section of scoredSections) {
    // Éviter les doublons
    const sectionKey = section.content.substring(0, 50);
    if (addedSections.has(sectionKey)) {
      continue;
    }
    
    if (currentTokens + section.tokens <= summaryThreshold) {
      // Ajouter la section complète
      if (result) {
        result += '\n\n';
      }
      result += section.content.trim();
      currentTokens += section.tokens;
      addedSections.add(sectionKey);
    } else if (currentTokens < targetTokens) {
      // Résumer les sections restantes importantes
      if (section.score > 1) {
        const remainingTokens = targetTokens - currentTokens;
        if (remainingTokens > 50) { // Au moins 50 tokens pour un résumé significatif
          const summary = summarizeSection(section.content, remainingTokens);
          if (summary && summary.trim().length > 20) {
            if (result) {
              result += '\n\n';
            }
            result += `📝 Résumé : ${summary}`;
            currentTokens += estimateTokens(summary) + 10; // +10 pour le préfixe
            addedSections.add(sectionKey);
          }
        }
      }
    }
    
    // Arrêter si on approche de la limite
    if (currentTokens >= targetTokens * 0.95) {
      break;
    }
  }

  // Nettoyer et vérifier le résultat final
  result = result
    .replace(/\n{3,}/g, '\n\n') // Normaliser les sauts de ligne multiples
    .replace(/\s+$/gm, '') // Supprimer les espaces en fin de ligne
    .trim();
  
  // Ajouter une note de compression seulement si beaucoup de contenu a été omis
  const compressionRatio = currentTokens / estimateTokens(content);
  if (result && compressionRatio < 0.7 && scoredSections.length > addedSections.size + 2) {
    result += '\n\n---\n💡 Note : Document optimisé pour une analyse efficace. Les sections clés ont été préservées.';
  }
  
  return result;
}

// Diviser le contenu en sections logiques
function splitIntoSections(content: string): string[] {
  // Diviser d'abord par les titres markdown
  const titleSections = content.split(/\n(?=#{1,3}\s)/);
  
  // Pour chaque section, diviser aussi par double saut de ligne si trop long
  const allSections: string[] = [];
  
  for (const section of titleSections) {
    if (estimateTokens(section) > 2000) {
      // Section trop longue, diviser par paragraphes
      const paragraphs = section.split(/\n\n+/);
      allSections.push(...paragraphs);
    } else {
      allSections.push(section);
    }
  }
  
  return allSections.filter(s => s.trim().length > 0);
}

// Calculer le score d'importance d'une section
function calculateSectionScore(section: string, priorityContent?: string[]): number {
  let score = 1;
  
  // Les titres sont importants
  if (section.match(/^#{1,3}\s/)) {
    score += 3;
  }
  
  // Contenu prioritaire défini par l'utilisateur
  if (priorityContent) {
    priorityContent.forEach(keyword => {
      if (section.toLowerCase().includes(keyword.toLowerCase())) {
        score += 5;
      }
    });
  }
  
  // Sections avec données structurées (tableaux, listes)
  if (section.includes('|') && section.split('|').length > 3) {
    score += 2; // Tableaux
  }
  if (section.match(/^\s*[-*]\s/m)) {
    score += 1; // Listes
  }
  
  // Sections avec nombres et données
  const numbers = section.match(/\d+/g);
  if (numbers && numbers.length > 2) {
    score += 2;
  }
  
  // Mots-clés importants
  const importantKeywords = [
    'conclusion', 'résumé', 'important', 'critique', 'essentiel',
    'recommandation', 'résultat', 'analyse', 'synthèse', 'objectif',
    'problème', 'solution', 'décision', 'action', 'priorité'
  ];
  
  importantKeywords.forEach(keyword => {
    if (section.toLowerCase().includes(keyword)) {
      score += 2;
    }
  });
  
  // Pénaliser les sections très courtes
  if (section.length < 100) {
    score *= 0.5;
  }
  
  return score;
}

// Résumer une section
function summarizeSection(content: string, maxTokens: number): string {
  // Stratégie améliorée : extraire les phrases complètes sans les tronquer
  // Normaliser le contenu
  const normalizedContent = content
    .replace(/\r\n/g, '\n') // Normaliser les sauts de ligne
    .replace(/\s+/g, ' ') // Normaliser les espaces
    .trim();
  
  // Découper en phrases de manière plus robuste
  const sentenceRegex = /[^.!?]+[.!?]+(?:\s|$)/g;
  const sentences = normalizedContent.match(sentenceRegex) || [];
  
  if (sentences.length === 0) {
    return '';
  }
  
  // Nettoyer et filtrer les phrases
  const cleanSentences = sentences
    .map(s => s.trim())
    .filter(s => {
      // Garder seulement les phrases significatives (entre 15 et 1000 caractères)
      return s.length >= 15 && s.length <= 1000 && /[a-zA-ZÀ-ÿ]{3,}/.test(s);
    });
  
  if (cleanSentences.length === 0) {
    return '';
  }
  
  // Prioriser les phrases avec des mots-clés importants
  const scoredSentences = cleanSentences.map(sentence => ({
    text: sentence,
    score: calculateSentenceImportance(sentence)
  }));
  
  scoredSentences.sort((a, b) => b.score - a.score);
  
  // Construire le résumé avec les phrases complètes
  let summary = '';
  let currentTokens = 0;
  const safetyMargin = 0.95; // Marge de sécurité pour éviter de dépasser
  const targetTokens = Math.floor(maxTokens * safetyMargin);
  
  for (const { text } of scoredSentences) {
    const sentenceTokens = estimateTokens(text);
    
    // Vérifier si on peut ajouter la phrase complète
    if (currentTokens + sentenceTokens <= targetTokens) {
      // S'assurer de ne pas avoir de double espaces ou de problèmes de ponctuation
      if (summary) {
        summary += ' ';
      }
      summary += text;
      currentTokens += sentenceTokens;
    } else if (currentTokens < targetTokens * 0.5) {
      // Si on a très peu de contenu, essayer d'ajouter au moins une partie
      const remainingTokens = targetTokens - currentTokens;
      if (remainingTokens > 50) { // Au moins 50 tokens (~200 caractères)
        // Tronquer la phrase à la fin d'un mot complet
        const maxChars = remainingTokens * 4;
        const truncated = truncateAtWordBoundary(text, maxChars);
        if (truncated && truncated.length > 50) {
          if (summary) {
            summary += ' ';
          }
          summary += truncated;
          if (!truncated.match(/[.!?]$/)) {
            summary += '...';
          }
          break;
        }
      }
    }
  }
  
  return summary.trim();
}

// Fonction helper pour tronquer à la limite d'un mot
function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  // Trouver la dernière position d'espace avant la limite
  let truncatePos = maxLength;
  while (truncatePos > 0 && text[truncatePos] !== ' ') {
    truncatePos--;
  }
  
  // Si on n'a pas trouvé d'espace, chercher d'autres séparateurs
  if (truncatePos === 0) {
    truncatePos = maxLength;
    const separators = [',', ';', ':', '-', '(', ')'];
    for (let i = maxLength; i > maxLength * 0.7; i--) {
      if (separators.includes(text[i])) {
        truncatePos = i + 1;
        break;
      }
    }
  }
  
  return text.substring(0, truncatePos).trim();
}

// Calculer l'importance d'une phrase
function calculateSentenceImportance(sentence: string): number {
  let score = 1;
  
  // Phrases avec chiffres
  if (/\d+/.test(sentence)) {
    score += 1;
  }
  
  // Phrases longues mais pas trop
  if (sentence.length > 50 && sentence.length < 200) {
    score += 1;
  }
  
  // Mots-clés importants
  const keywords = ['doit', 'devrait', 'important', 'nécessaire', 'résultat', 'conclusion'];
  keywords.forEach(keyword => {
    if (sentence.toLowerCase().includes(keyword)) {
      score += 1;
    }
  });
  
  return score;
}

// Fonction pour extraire les mots-clés d'une requête
export function extractKeywordsFromQuery(query: string): string[] {
  // Mots vides à ignorer
  const stopWords = new Set([
    'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 
    'dans', 'sur', 'avec', 'pour', 'par', 'à', 'au', 'aux', 'ce', 
    'ces', 'cet', 'cette', 'qui', 'que', 'quoi', 'dont', 'où'
  ]);
  
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 10); // Limiter à 10 mots-clés
} 