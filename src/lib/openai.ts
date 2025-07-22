import OpenAI from 'openai';
import { 
  MAX_TOKENS, 
  MAX_TOKENS_PER_DOC, 
  MAX_SYSTEM_TOKENS, 
  MAX_HISTORY_TOKENS,
  MAX_RESPONSE_TOKENS 
} from './constants';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SYSTEM_PROMPT = `Tu es Ringo, un expert en analyse de documents spécialisé dans la génération de rapports pour un public québécois.

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

Lors de la rédaction de textes en français, veuillez respecter les règles typographiques françaises suivantes :

Titres : N'utilisez pas de majuscules, sauf pour le premier mot et les noms propres. Par exemple, un titre correct serait : "Les Règles typographiques françaises" et non "Les Règles Typographiques Françaises".

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
  
  return documents.map((doc, index) => {
    // Find relevant content for each document
    const relevantContent = findRelevantContent(query, doc, maxTokensPerDoc);
    
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
  try {
    if (!documentContent?.trim()) {
      throw new Error('Aucun contenu disponible pour analyse.');
    }

    // Estimer les tokens du contexte des documents
    const documentTokens = estimateTokens(documentContent);
    const messagesTokens = messages.reduce((total, msg) => total + estimateTokens(msg.content), 0);
    const systemTokens = estimateTokens(SYSTEM_PROMPT) + estimateTokens(COMPARATIVE_ANALYSIS_PROMPT || '');
    
    const totalTokens = documentTokens + messagesTokens + systemTokens;
    
    // Si on dépasse la limite, tronquer le contexte des documents
    let truncatedDocumentContext = documentContent;
    if (totalTokens > MAX_TOKENS - MAX_RESPONSE_TOKENS) { // Garder des tokens pour la réponse
      console.warn(`Contexte trop grand (${totalTokens} tokens), troncature nécessaire`);
      
      // Extraire la question de l'utilisateur pour optimiser le contexte
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      const userQuery = lastUserMessage?.content || '';
      
      // Préparer le contenu des documents avec limitation
      const documents = documentContent.split(/====== DOCUMENT ACTIF/).filter(Boolean);
      const maxTokensPerDoc = Math.floor((MAX_TOKENS - systemTokens - messagesTokens - MAX_RESPONSE_TOKENS) / documents.length);
      
      truncatedDocumentContext = documents.map((doc, index) => {
        const relevantContent = findRelevantContent(userQuery, doc, maxTokensPerDoc);
        return `====== DOCUMENT ACTIF${relevantContent}`;
      }).join('\n\n---\n\n');
    }

    const preparedMessages = await prepareMessages(messages, truncatedDocumentContext);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: preparedMessages,
      temperature: 0.7,
      max_tokens: MAX_RESPONSE_TOKENS,
      presence_penalty: 0.1,
      frequency_penalty: 0.2,
      response_format: { type: 'text' },
      top_p: 0.95
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response content received from OpenAI');
    }

    return response;
  } catch (error: any) {
    // Vérifier plusieurs formats d'erreur possibles pour la limite de tokens
    const isTokenLimitError = 
      error?.error?.code === 'context_length_exceeded' ||
      error?.response?.data?.error?.code === 'context_length_exceeded' ||
      (error?.message && error.message.includes('maximum context length')) ||
      (error?.message && error.message.includes('tokens')) ||
      (error?.status === 400 && error?.message?.includes('too many tokens'));
    
    if (isTokenLimitError) {
      console.warn("Limite de tokens dépassée, utilisation d'un contexte minimal");
      
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) throw new Error('No message to process');

      // Créer un contexte minimal avec seulement un résumé
      const minimalContext = `
CONTEXTE RÉDUIT - Limite de tokens dépassée
===========================================
Le contexte complet des documents est trop volumineux.
Veuillez reformuler votre question de manière plus spécifique ou traiter moins de documents à la fois.

Nombre de documents dans la conversation: ${(documentContent?.match(/====== DOCUMENT ACTIF/g) || []).length}
`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: minimalContext },
          lastMessage
        ],
        temperature: 0.7,
        max_tokens: 1000, // Réponse plus courte pour le contexte minimal
        presence_penalty: 0.1,
        frequency_penalty: 0.2,
        response_format: { type: 'text' },
        top_p: 0.95
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response content received from OpenAI');
      }
      
      return response + "\n\n*Note: La réponse a été générée avec un contexte réduit car la limite de tokens a été dépassée. Pour une analyse complète, veuillez traiter moins de documents à la fois ou poser des questions plus spécifiques.*";
    }
    
    throw new Error(`Failed to generate response: ${error.message}`);
  }
}

export async function generateChatResponseStreaming(
  messages: ChatMessage[], 
  documentContent?: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  try {
    if (!documentContent?.trim()) {
      throw new Error('Aucun contenu disponible pour analyse.');
    }

    // Estimer les tokens du contexte des documents
    const documentTokens = estimateTokens(documentContent);
    const messagesTokens = messages.reduce((total, msg) => total + estimateTokens(msg.content), 0);
    const systemTokens = estimateTokens(SYSTEM_PROMPT) + estimateTokens(COMPARATIVE_ANALYSIS_PROMPT || '');
    
    const totalTokens = documentTokens + messagesTokens + systemTokens;
    
    // Si on dépasse la limite, tronquer le contexte des documents
    let truncatedDocumentContext = documentContent;
    if (totalTokens > MAX_TOKENS - MAX_RESPONSE_TOKENS) { // Garder des tokens pour la réponse
      console.warn(`Contexte trop grand (${totalTokens} tokens), troncature nécessaire`);
      
      // Extraire la question de l'utilisateur pour optimiser le contexte
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      const userQuery = lastUserMessage?.content || '';
      
      // Préparer le contenu des documents avec limitation
      const documents = documentContent.split(/====== DOCUMENT ACTIF/).filter(Boolean);
      const maxTokensPerDoc = Math.floor((MAX_TOKENS - systemTokens - messagesTokens - MAX_RESPONSE_TOKENS) / documents.length);
      
      truncatedDocumentContext = documents.map((doc, index) => {
        const relevantContent = findRelevantContent(userQuery, doc, maxTokensPerDoc);
        return `====== DOCUMENT ACTIF${relevantContent}`;
      }).join('\n\n---\n\n');
    }

    const preparedMessages = await prepareMessages(messages, truncatedDocumentContext);
    let fullResponse = '';

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: preparedMessages,
      temperature: 0.7,
      max_tokens: MAX_RESPONSE_TOKENS,
      presence_penalty: 0.1,
      frequency_penalty: 0.2,
      stream: true,
      top_p: 0.95
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (!content) continue;

      fullResponse += content;
      onChunk(content);
    }

    return fullResponse;
  } catch (error: any) {
    // Vérifier plusieurs formats d'erreur possibles pour la limite de tokens
    const isTokenLimitError = 
      error?.error?.code === 'context_length_exceeded' ||
      error?.response?.data?.error?.code === 'context_length_exceeded' ||
      (error?.message && error.message.includes('maximum context length')) ||
      (error?.message && error.message.includes('tokens')) ||
      (error?.status === 400 && error?.message?.includes('too many tokens'));
    
    if (isTokenLimitError) {
      console.warn("Limite de tokens dépassée, utilisation d'un contexte minimal");
      
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) throw new Error('No message to process');

      // Créer un contexte minimal
      const minimalContext = `
CONTEXTE RÉDUIT - Limite de tokens dépassée
===========================================
Le contexte complet des documents est trop volumineux.
Veuillez reformuler votre question de manière plus spécifique ou traiter moins de documents à la fois.

Nombre de documents dans la conversation: ${(documentContent?.match(/====== DOCUMENT ACTIF/g) || []).length}
`;

      // Envoyer un message d'avertissement avant la réponse
      const warningMessage = "*⚠️ Attention: La limite de tokens a été dépassée. Génération d'une réponse avec un contexte réduit...*\n\n";
      onChunk(warningMessage);
      
      let fullResponse = warningMessage;

      const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: minimalContext },
          lastMessage
        ],
        temperature: 0.7,
        max_tokens: 1000,
        presence_penalty: 0.1,
        frequency_penalty: 0.2,
        stream: true,
        top_p: 0.95
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (!content) continue;

        fullResponse += content;
        onChunk(content);
      }

      const noteMessage = "\n\n*Note: Pour une analyse complète, veuillez traiter moins de documents à la fois ou poser des questions plus spécifiques.*";
      onChunk(noteMessage);
      fullResponse += noteMessage;

      return fullResponse;
    }
    
    throw new Error(`Failed to generate streaming response: ${error.message}`);
  }
}