import OpenAI from 'openai';
import { 
  MAX_TOKENS, 
  MAX_TOKENS_PER_DOC, 
  MAX_SYSTEM_TOKENS, 
  MAX_HISTORY_TOKENS,
  MAX_RESPONSE_TOKENS 
} from './constants';

// Client OpenAI désactivé pour des raisons de sécurité
// Toutes les fonctionnalités IA passent maintenant par les Edge Functions
// const openai = new OpenAI({
//   apiKey: import.meta.env.VITE_OPENAI_API_KEY,
//   dangerouslyAllowBrowser: true
// });

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SYSTEM_PROMPT = `Tu es Ringo, un expert en analyse de documents spécialisé dans la génération de rapports pour un public québécois.

🔴 RÈGLE ABSOLUE DE QUALITÉ LINGUISTIQUE 🔴
Tu DOIS produire des réponses PARFAITES sur le plan grammatical et orthographique :
- AUCUNE faute d'orthographe tolérée
- AUCUNE erreur grammaticale acceptée
- Syntaxe française impeccable
- Ponctuation correcte et appropriée
- Accords grammaticaux respectés (genre, nombre, temps)
- Conjugaisons exactes

Adapte ton langage et ton style pour un public québécois:
- Utilise un vocabulaire et des expressions courantes au Québec quand c'est pertinent
- Adopte un ton direct, pragmatique et concret
- Évite les formulations trop complexes ou alambiquées
- Préfère les exemples concrets aux explications théoriques
- Sois précis et factuel, sans exagération ni superlatifs inutiles

Pour une meilleure lisibilité, structure tes réponses avec :
- Des titres en utilisant "##" pour les sections principales
- Des sous-titres en utilisant "###" pour les sous-sections
- Des points importants en **gras**
- Des listes à puces pour énumérer des éléments
- Des sauts de ligne pour aérer le texte

VÉRIFICATION FINALE : Avant de répondre, TOUJOURS relire mentalement ta réponse pour t'assurer qu'il n'y a AUCUNE erreur linguistique.

Lors de la rédaction de textes en français, veuillez respecter les règles typographiques françaises suivantes :

Titres : N'utilisez pas de majuscules, sauf pour le premier mot et les noms propres. Par exemple, un titre correct serait : "Les règles typographiques françaises" et non "Les Règles Typographiques Françaises".

Guillemets : Utilisez les guillemets français (ou guillemets typographiques) pour les citations et les dialogues. Les guillemets français sont des guillemets doubles angulaires :

Guillemets ouvrants : «
Guillemets fermants : » Exemple : « Bonjour, comment ça va ? »
Apostrophes : Utilisez l'apostrophe typographique (') et non l'apostrophe droite ('). L'apostrophe typographique est courbée et s'utilise pour les élisions.
Exemple : L'apostrophe typographique est préférable à l'apostrophe droite.`;

export const COMPARATIVE_ANALYSIS_PROMPT = `
ANALYSE COMPARATIVE ET CROISEMENT DE DOCUMENTS
==============================================

Lorsque plusieurs documents sont fournis dans une conversation, tu dois :

1. IDENTIFIER LES RELATIONS
   - Repérer les points communs entre les documents
   - Identifier les différences et contradictions
   - Mettre en évidence les complémentarités

2. SYNTHÉTISER L'INFORMATION
   - Créer une vue d'ensemble cohérente
   - Éviter les répétitions inutiles
   - Prioriser les informations les plus pertinentes

3. CROISER LES DONNÉES
   - Comparer les chiffres et statistiques
   - Rapprocher les concepts similaires
   - Identifier les tendances communes

4. RÉPONDRE DE MANIÈRE INTÉGRÉE
   - Utiliser TOUS les documents pertinents
   - Citer les sources (nom du document)
   - Indiquer quand une info vient d'un document spécifique

5. CAPACITÉS SPÉCIALES MULTI-DOCUMENTS
   - Comparaisons détaillées
   - Synthèses thématiques
   - Analyses croisées
   - Tableaux comparatifs
   - Résumés consolidés

EXEMPLES DE TÂCHES MULTI-DOCUMENTS :
- "Compare les données de ces 3 rapports"
- "Synthétise les points clés de tous les documents"
- "Trouve les contradictions entre ces textes"
- "Crée un tableau comparatif des différentes approches"
- "Quels sont les points communs entre tous ces documents ?"

IMPORTANT : Toujours préciser de quel(s) document(s) provient chaque information importante.
`;

// Function to estimate tokens (4 chars ≈ 1 token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Function to truncate text to a specific token limit
function truncateToTokenLimit(text: string, maxTokens: number): string {
  const estimatedTokens = estimateTokens(text);
  if (estimatedTokens <= maxTokens) {
    return text;
  }

  // Split into paragraphs and accumulate until limit
  const paragraphs = text.split('\n\n');
  let result = '';
  let currentTokens = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);
    if (currentTokens + paragraphTokens > maxTokens) {
      break;
    }
    result += (result ? '\n\n' : '') + paragraph;
    currentTokens += paragraphTokens;
  }

  return result + '\n\n[Texte tronqué pour respecter la limite de tokens]';
}

// Function to detect if a query is asking for comparative analysis
function isComparativeAnalysisQuery(query: string): boolean {
  const comparativeKeywords = [
    'compare', 'comparaison', 'différence', 'similitude', 'contraste',
    'versus', 'vs', 'tableau', 'différent', 'semblable', 'distinguer',
    'comparer', 'distinction', 'différencier', 'ressemblance',
    'différentes visions', 'différentes missions', 'différentes approches'
  ];
  
  const queryLower = query.toLowerCase();
  
  // Check if query contains comparative keywords
  const hasComparativeKeyword = comparativeKeywords.some(keyword => 
    queryLower.includes(keyword)
  );
  
  // Check if query mentions multiple entities
  const mentionsMultipleEntities = (
    (queryLower.match(/document[s]?/g) || []).length > 1 ||
    (queryLower.match(/institut[s]?/g) || []).length > 1 ||
    queryLower.includes('plusieurs') ||
    queryLower.includes('multiples') ||
    queryLower.includes('entre les')
  );
  
  return hasComparativeKeyword || mentionsMultipleEntities;
}

// Function to find relevant content based on query
function findRelevantContent(query: string, content: string, maxTokens: number): string {
  const paragraphs = content.split('\n\n');
  
  // Score paragraphs based on relevance
  const scoredParagraphs = paragraphs.map(p => {
    // Split query into words
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    // Calculate base score from term matches
    const baseScore = queryTerms.reduce((score, term) => {
      // Escape special regex characters
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedTerm, 'gi');
      const matches = (p.match(regex) || []).length;
      return score + matches;
    }, 0);

    // Apply content-based scoring factors
    const hasHeader = /^#{1,3}\s/.test(p);
    const hasNumbers = /\d+/.test(p);
    const hasKeyPhrases = /(important|clé|critique|essentiel|conclusion|recommand|analyse|résultat)/i.test(p);
    const isShortParagraph = p.length < 200;

    // Calculate final score with weights
    let finalScore = baseScore;
    if (hasHeader) finalScore *= 1.5;
    if (hasNumbers) finalScore *= 1.2;
    if (hasKeyPhrases) finalScore *= 1.3;
    if (isShortParagraph) finalScore *= 1.1;

    return { text: p, score: finalScore };
  });

  // Sort by relevance score
  scoredParagraphs.sort((a, b) => b.score - a.score);

  // Build context with most relevant content
  let result = '';
  let tokens = 0;

  // Always include high-scoring paragraphs
  for (const para of scoredParagraphs) {
    if (para.score === 0) continue;
    
    const paraTokens = estimateTokens(para.text);
    if (tokens + paraTokens > maxTokens) {
      break;
    }
    
    result += (result ? '\n\n' : '') + para.text;
    tokens += paraTokens;
  }

  // If no relevant content found, include introduction and conclusion
  if (!result) {
    const intro = paragraphs[0] || '';
    const conclusion = paragraphs[paragraphs.length - 1] || '';
    result = [intro, conclusion].filter(Boolean).join('\n\n');
    if (estimateTokens(result) > maxTokens) {
      result = truncateToTokenLimit(result, maxTokens);
    }
  }

  return result;
}

// Function to prepare document content
function prepareDocumentContent(documents: string[], query: string): string {
  // Calculate token budget per document
  const maxTokensPerDoc = Math.floor(
    (MAX_TOKENS - MAX_SYSTEM_TOKENS - MAX_HISTORY_TOKENS) / documents.length
  );
  
  // Log l'allocation des tokens
  console.log(`📊 Allocation des tokens pour ${documents.length} documents:`);
  console.log(`- Tokens totaux disponibles: ${MAX_TOKENS - MAX_SYSTEM_TOKENS - MAX_HISTORY_TOKENS}`);
  console.log(`- Tokens par document: ${maxTokensPerDoc}`);
  console.log(`- Caractères approximatifs par document: ${maxTokensPerDoc * 4}`);
  
  return documents.map((doc, index) => {
    // Find relevant content for each document
    const relevantContent = findRelevantContent(query, doc, maxTokensPerDoc);
    
    // Log la taille du contenu extrait
    const extractedTokens = estimateTokens(relevantContent);
    console.log(`📄 Document ${index + 1}: ${extractedTokens} tokens extraits`);
    
    // Add document separator and metadata
    return `
====== DOCUMENT ${index + 1} ======

${relevantContent}

====== FIN DOCUMENT ${index + 1} ======

INSTRUCTIONS: Le texte ci-dessus contient le contenu pertinent du document ${index + 1}. Utilise ce contenu pour répondre de manière détaillée à la question de l'utilisateur.
`;
  }).join('\n\n---\n\n');
}

export async function prepareMessages(
  messages: ChatMessage[],
  documentContext?: string
): Promise<ChatMessage[]> {
  const systemMessages: ChatMessage[] = [{
    role: 'system',
    content: SYSTEM_PROMPT
  }];

  // Ajouter le prompt d'analyse comparative si plusieurs documents
  if (documentContext) {
    const documentCount = (documentContext.match(/====== DOCUMENT ACTIF/g) || []).length;
    
    if (documentCount > 1) {
      systemMessages.push({
        role: 'system',
        content: COMPARATIVE_ANALYSIS_PROMPT
      });
    }
    
    // Toujours ajouter l'isolation du contexte
    systemMessages.push({
      role: 'system',
      content: `RÈGLE CRITIQUE D'ISOLATION DU CONTEXTE
Tu as accès UNIQUEMENT aux ${documentCount} document(s) fournis dans cette conversation.
INTERDICTION ABSOLUE de faire référence à :
- Des documents d'autres conversations
- Des connaissances externes non présentes dans les documents fournis
- Des informations de ta base de connaissances générale sauf si explicitement demandé

Si une information n'est pas dans les documents fournis, tu dois clairement dire que tu ne peux pas répondre avec les documents disponibles.`
    });
    
    systemMessages.push({
      role: 'system',
      content: documentContext
    });
  }

  return [...systemMessages, ...messages];
}

export async function generateChatResponse(messages: ChatMessage[], documentContent?: string): Promise<string> {
  throw new Error('Cette fonction est désactivée pour des raisons de sécurité. Utilisez generateChatResponseSecure depuis secureChat.ts à la place.');
}

export async function generateChatResponseStreaming(
  messages: ChatMessage[], 
  onChunk: (chunk: string) => void,
  documentContent?: string
): Promise<string> {
  throw new Error('Cette fonction est désactivée pour des raisons de sécurité. Utilisez generateChatResponseStreamingSecure depuis secureChat.ts à la place.');
}