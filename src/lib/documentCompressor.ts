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

  for (const section of scoredSections) {
    if (currentTokens + section.tokens <= summaryThreshold) {
      // Ajouter la section complète
      result += section.content + '\n\n';
      currentTokens += section.tokens;
    } else if (currentTokens < targetTokens) {
      // Résumer les sections restantes importantes
      if (section.score > 1) {
        const remainingTokens = targetTokens - currentTokens;
        const summary = summarizeSection(section.content, remainingTokens);
        if (summary) {
          result += `[Résumé] ${summary}\n\n`;
          currentTokens += estimateTokens(summary);
        }
      }
    }
  }

  // Ajouter une note de compression
  result += '\n---\n[Note: Document compressé automatiquement pour optimiser le traitement]';
  
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
  // Stratégie simple : extraire les phrases clés
  const sentences = content
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);
  
  if (sentences.length === 0) {
    return '';
  }
  
  // Prioriser les phrases avec des mots-clés importants
  const scoredSentences = sentences.map(sentence => ({
    text: sentence,
    score: calculateSentenceImportance(sentence)
  }));
  
  scoredSentences.sort((a, b) => b.score - a.score);
  
  // Construire le résumé avec les phrases les plus importantes
  let summary = '';
  let currentTokens = 0;
  const maxChars = maxTokens * 4; // Approximation
  
  for (const { text } of scoredSentences) {
    if (currentTokens + estimateTokens(text) <= maxTokens && 
        summary.length + text.length <= maxChars) {
      summary += (summary ? '. ' : '') + text;
      currentTokens += estimateTokens(text);
    }
  }
  
  return summary ? summary + '.' : '';
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