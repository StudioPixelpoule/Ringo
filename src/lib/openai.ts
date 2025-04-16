import OpenAI from 'openai';

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

if (!apiKey) {
  throw new Error(
    'VITE_OPENAI_API_KEY is not set in environment variables. ' +
    'Please add it to your .env file: VITE_OPENAI_API_KEY=your_api_key_here'
  );
}

const openai = new OpenAI({
  apiKey,
  dangerouslyAllowBrowser: true
});

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SYSTEM_PROMPT = `Tu es un expert en analyse de documents spécialisé dans la génération de rapports pour un public québécois.

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

const COMPARATIVE_ANALYSIS_PROMPT = `Lorsqu'une requête concerne l'analyse comparative de plusieurs documents ou instituts:

1. IMPORTANT: TOUJOURS analyser d'abord chaque document séparément avant de procéder à une comparaison.

2. Pour chaque document/institut:
   - Extraire UNIQUEMENT les informations explicitement mentionnées
   - Si une vision/mission n'est pas clairement identifiée, indiquer "Non mentionnée explicitement"
   - Ne jamais générer ou inférer une vision non explicite

3. Format de réponse pour les comparaisons:
   - Utiliser un tableau avec des colonnes uniformes
   - Citer les sources exactes quand elles existent
   - Utiliser des formulations identiques pour les cas similaires

4. Avant de finaliser la réponse:
   - Vérifier la cohérence entre les analyses individuelles et la synthèse
   - S'assurer que toutes les informations proviennent directement des documents

5. Dernière vérification: Ne jamais présenter une interprétation comme un fait explicite du document.`;

// Constants for token limits
const MAX_TOKENS = 128000; // GPT-4o context window
const MAX_TOKENS_PER_DOC = Math.floor(MAX_TOKENS * 0.7); // 70% of context for documents
const MAX_SYSTEM_TOKENS = 2000; // Reserve 2K tokens for system messages
const MAX_HISTORY_TOKENS = 4000; // Reserve 4K tokens for conversation history

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

function prepareMessages(messages: ChatMessage[], documentContent?: string): ChatMessage[] {
  const preparedMessages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  if (documentContent) {
    // Get the user's latest query
    const latestQuery = messages[messages.length - 1]?.content || '';
    
    // Check if this is a comparative analysis query
    if (isComparativeAnalysisQuery(latestQuery)) {
      preparedMessages.push({
        role: 'system',
        content: COMPARATIVE_ANALYSIS_PROMPT
      });
    }

    preparedMessages.push({
      role: 'system',
      content: `Tu as reçu plusieurs documents à analyser. Tu dois :
1. Analyser en profondeur le contenu de chaque document
2. Identifier les points clés et les mettre en évidence
3. Comparer et contraster les informations entre les documents
4. Fournir une réponse détaillée et structurée
5. Citer des passages pertinents pour appuyer ton analyse

Si tu ne trouves pas l'information dans les documents, indique-le clairement.`
    });

    preparedMessages.push({
      role: 'system',
      content: prepareDocumentContent(documentContent.split('---\n\n'), latestQuery)
    });
  }

  // Add recent conversation history for context
  const historyMessages = messages.slice(-5); // Keep last 5 messages
  let historyTokens = 0;

  for (const message of historyMessages) {
    const tokens = estimateTokens(message.content);
    if (historyTokens + tokens > MAX_HISTORY_TOKENS) break;
    preparedMessages.push(message);
    historyTokens += tokens;
  }

  return preparedMessages;
}

export async function generateChatResponse(messages: ChatMessage[], documentContent?: string): Promise<string> {
  try {
    if (!documentContent?.trim()) {
      throw new Error('Aucun contenu disponible pour analyse.');
    }

    const preparedMessages = prepareMessages(messages, documentContent);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: preparedMessages,
      temperature: 0.7,
      max_tokens: 4000,
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
    if (error?.error?.code === 'context_length_exceeded') {
      console.warn("Limite de tokens dépassée, nouvel essai avec contexte minimal");
      
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) throw new Error('No message to process');

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          lastMessage
        ],
        temperature: 0.7,
        max_tokens: 4000,
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

    const preparedMessages = prepareMessages(messages, documentContent);
    let fullResponse = '';

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: preparedMessages,
      temperature: 0.7,
      max_tokens: 4000,
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
    if (error?.error?.code === 'context_length_exceeded') {
      console.warn("Limite de tokens dépassée, nouvel essai avec contexte minimal");
      
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) throw new Error('No message to process');

      return generateChatResponseStreaming(
        [{ role: 'system', content: SYSTEM_PROMPT }, lastMessage],
        documentContent,
        onChunk
      );
    }
    
    throw new Error(`Failed to generate streaming response: ${error.message}`);
  }
}