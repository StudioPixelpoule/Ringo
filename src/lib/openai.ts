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

const SYSTEM_PROMPT = `Tu es Ringo, un assistant IA expert en analyse de documents.

Pour une meilleure lisibilité, structure tes réponses avec :

- Des titres en utilisant "##" pour les sections principales
- Des sous-titres en utilisant "###" pour les sous-sections
- Des points importants en **gras**
- Des listes à puces pour énumérer des éléments
- Des sauts de ligne pour aérer le texte

Pour les documents textuels :
- Analyse le contenu et la structure en profondeur
- Identifie et explique les sections principales
- Met en évidence les informations critiques
- Propose une synthèse détaillée et argumentée
- Fournis des exemples concrets tirés des documents

Pour l'analyse croisée des documents :
- Compare systématiquement les contenus de manière approfondie
- Identifie et explique les points communs et les différences
- Relève et analyse les éventuelles contradictions
- Montre comment les documents se complètent et s'enrichissent
- Propose une synthèse globale intégrant tous les aspects

Pour chaque point important :
- Cite les passages pertinents des documents
- Explique le contexte et les implications
- Fournis une analyse détaillée
- Propose des recommandations concrètes

À la fin de chaque réponse, propose des suggestions pour approfondir l'analyse :

## Pour approfondir...
- "Souhaitez-vous des détails supplémentaires sur certains points ?"
- "Je peux analyser plus en profondeur certains aspects, lesquels vous intéressent ?"
- "Voulez-vous explorer d'autres perspectives ou angles d'analyse ?"

Sois exhaustif et précis dans tes réponses tout en maintenant une structure claire.`;

// Constants for token limits
const MAX_TOKENS = 128000; // GPT-4 Turbo context window
const MAX_TOKENS_PER_DOC = Math.floor(MAX_TOKENS * 0.7 / 10); // Allow up to 10 docs
const MAX_SYSTEM_TOKENS = 2000;
const MAX_HISTORY_TOKENS = 4000;

function estimateTokens(text: string): number {
  // GPT models use ~4 characters per token on average
  return Math.ceil(text.length / 4);
}

function truncateText(text: string, maxTokens: number): string {
  const estimatedTokens = estimateTokens(text);
  if (estimatedTokens <= maxTokens) {
    return text;
  }

  // Split into paragraphs and accumulate until we hit the token limit
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

function findRelevantContent(query: string, content: string, maxTokens: number): string {
  const paragraphs = content.split('\n\n');
  
  // Score paragraphs based on query relevance
  const scoredParagraphs = paragraphs.map(p => {
    // Split query into words and phrases
    const queryTerms = [
      ...query.toLowerCase().split(/\s+/),
      ...query.toLowerCase().match(/".+?"/g)?.map(m => m.slice(1, -1)) || []
    ];

    // Calculate base score from term matches
    const baseScore = queryTerms.reduce((score, term) => {
      const regex = new RegExp(term, 'gi');
      const matches = (p.match(regex) || []).length;
      return score + matches;
    }, 0);

    // Apply content-based scoring factors
    const hasHeader = /^#{1,3}\s/.test(p);
    const hasNumbers = /\d+/.test(p);
    const hasKeyPhrases = /(important|clé|critique|essentiel|conclusion|recommand|analyse|résultat)/i.test(p);
    const isShortParagraph = p.length < 200; // Prefer concise paragraphs

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
  let contextAdded = false;

  // Always include high-scoring paragraphs
  for (const para of scoredParagraphs) {
    if (para.score === 0) continue;
    
    const paraTokens = estimateTokens(para.text);
    if (tokens + paraTokens > maxTokens) {
      if (!contextAdded && result === '') {
        result = para.text;
      }
      break;
    }
    
    result += (result ? '\n\n' : '') + para.text;
    tokens += paraTokens;
    contextAdded = true;
  }

  // If no relevant content found, include introduction and conclusion
  if (!result) {
    const intro = paragraphs[0] || '';
    const conclusion = paragraphs[paragraphs.length - 1] || '';
    result = [intro, conclusion].filter(Boolean).join('\n\n');
    if (estimateTokens(result) > maxTokens) {
      result = truncateText(result, maxTokens);
    }
  }

  return result;
}

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
      model: 'gpt-4-turbo-preview',
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
        model: 'gpt-4-turbo-preview',
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
    let pendingFormatting = {
      codeBlock: false,
      listItem: false,
      heading: false,
      emphasis: false,
      strong: false,
      link: false
    };

    const stream = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
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

      // Detect and handle formatting elements
      if (content.includes('```')) {
        pendingFormatting.codeBlock = !pendingFormatting.codeBlock;
      }
      if (content.match(/^#+\s/)) {
        pendingFormatting.heading = true;
      }
      if (content.includes('\n')) {
        pendingFormatting.heading = false;
        pendingFormatting.listItem = false;
      }
      if (content.match(/^[-*]\s/)) {
        pendingFormatting.listItem = true;
      }
      if (content.includes('**')) {
        pendingFormatting.strong = !pendingFormatting.strong;
      }
      if (content.includes('*') && !content.includes('**')) {
        pendingFormatting.emphasis = !pendingFormatting.emphasis;
      }
      if (content.includes('[')) {
        pendingFormatting.link = true;
      }
      if (content.includes(')') && pendingFormatting.link) {
        pendingFormatting.link = false;
      }

      // Add content to full response
      fullResponse += content;

      // Send chunk with formatting preserved
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