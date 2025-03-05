import OpenAI from 'openai';

// Get API key from environment
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

if (!apiKey) {
  throw new Error(
    'VITE_OPENAI_API_KEY is not set in environment variables. ' +
    'Please add it to your .env file: VITE_OPENAI_API_KEY=your_api_key_here'
  );
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey,
  dangerouslyAllowBrowser: true
});

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SYSTEM_PROMPT = `Tu es Ringo, un assistant IA expert en analyse de documents et de fichiers audio. 
Pour une meilleure lisibilité, structure tes réponses avec :

- Des titres en utilisant "##" pour les sections principales
- Des sous-titres en utilisant "###" pour les sous-sections
- Des points importants en **gras**
- Des listes à puces pour énumérer des éléments
- Des sauts de ligne pour aérer le texte

Pour les fichiers audio :
- Analyse la transcription fournie
- Identifie les points clés et les thèmes principaux
- Utilise les segments temporels pour référencer des moments précis
- Fournis un résumé structuré du contenu

Pour les documents textuels :
- Analyse le contenu et la structure
- Identifie les sections principales
- Met en évidence les informations importantes
- Propose une synthèse claire

Sois concis et précis dans tes réponses.`;

function estimateTokens(text: string): number {
  // GPT models use ~4 chars per token on average
  return Math.ceil(text.length / 4);
}

function truncateToTokenLimit(text: string, maxTokens: number): string {
  if (estimateTokens(text) <= maxTokens) return text;

  // Split into paragraphs and add until we reach the limit
  const paragraphs = text.split('\n\n');
  let result = '';
  let tokens = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);
    if (tokens + paragraphTokens > maxTokens) break;
    result += (result ? '\n\n' : '') + paragraph;
    tokens += paragraphTokens;
  }

  return result;
}

function findRelevantContent(query: string, content: string, maxTokens: number): string {
  // Split content into paragraphs
  const paragraphs = content.split('\n\n');
  
  // Score each paragraph based on relevance to query
  const scoredParagraphs = paragraphs.map(p => ({
    text: p,
    score: query.toLowerCase().split(/\s+/).reduce((score, word) => 
      score + (p.toLowerCase().includes(word) ? 1 : 0), 0
    )
  }));

  // Sort by relevance score
  scoredParagraphs.sort((a, b) => b.score - a.score);

  // Combine most relevant paragraphs within token limit
  let result = '';
  let tokens = 0;

  for (const para of scoredParagraphs) {
    const paraTokens = estimateTokens(para.text);
    if (tokens + paraTokens > maxTokens) break;
    result += (result ? '\n\n' : '') + para.text;
    tokens += paraTokens;
  }

  return result;
}

function prepareMessages(messages: ChatMessage[], documentContent?: string): ChatMessage[] {
  const MAX_TOKENS = 6000; // Leave room for response
  const SYSTEM_TOKENS = estimateTokens(SYSTEM_PROMPT);
  const MAX_HISTORY_TOKENS = 1000;
  const MAX_DOCUMENT_TOKENS = MAX_TOKENS - SYSTEM_TOKENS - MAX_HISTORY_TOKENS;

  const preparedMessages: ChatMessage[] = [{
    role: 'system',
    content: SYSTEM_PROMPT
  }];

  // Add document context if available
  if (documentContent) {
    try {
      const parsed = JSON.parse(documentContent);
      const lastUserMessage = messages.findLast(m => m.role === 'user')?.content || '';
      
      // Extract metadata
      const metadata = parsed.metadata || {};
      const fileType = metadata.fileType || 'document';
      const duration = metadata.duration ? `\nDurée: ${Math.round(metadata.duration)} secondes` : '';
      const segments = metadata.segments || [];

      // Get relevant content based on user's query
      const relevantContent = findRelevantContent(
        lastUserMessage,
        parsed.text || documentContent,
        MAX_DOCUMENT_TOKENS - 500 // Reserve tokens for metadata
      );

      let contextMessage = `
Type de fichier: ${fileType}
${metadata.title ? `Titre: ${metadata.title}` : ''}${duration}
${metadata.language ? `Langue: ${metadata.language}` : ''}

Contenu pertinent:
${relevantContent}`;

      // Add audio segments if available and relevant
      if (segments.length > 0) {
        const relevantSegments = segments
          .filter(s => relevantContent.includes(s.text))
          .map(s => `[${Math.floor(s.start)}s - ${Math.ceil(s.end)}s] ${s.text}`)
          .join('\n');

        if (relevantSegments) {
          contextMessage += '\n\nSegments temporels pertinents:\n' + relevantSegments;
        }
      }

      preparedMessages.push({
        role: 'system',
        content: truncateToTokenLimit(contextMessage, MAX_DOCUMENT_TOKENS)
      });
    } catch (error) {
      // Fallback for plain text
      preparedMessages.push({
        role: 'system',
        content: truncateToTokenLimit(documentContent, MAX_DOCUMENT_TOKENS)
      });
    }
  }

  // Add conversation history
  let historyTokens = 0;
  const recentMessages = [...messages].reverse();

  for (const message of recentMessages) {
    const tokens = estimateTokens(message.content);
    if (historyTokens + tokens > MAX_HISTORY_TOKENS) break;
    preparedMessages.push(message);
    historyTokens += tokens;
  }

  return preparedMessages;
}

export async function generateChatResponse(messages: ChatMessage[], documentContent?: string): Promise<string> {
  try {
    const preparedMessages = prepareMessages(messages, documentContent);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: preparedMessages,
      temperature: 0.7,
      max_tokens: 1000,
      stream: true,
      presence_penalty: -0.5,
      frequency_penalty: 0.3,
    });

    let response = '';
    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content || '';
      response += content;
    }

    return response;
  } catch (error: any) {
    console.error('[OpenAI] Error generating response:', error);

    // Handle token limit errors gracefully
    if (error?.error?.code === 'context_length_exceeded') {
      console.warn('[OpenAI] Token limit exceeded, retrying with minimal context');
      
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) throw new Error('No message to process');

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          lastMessage
        ],
        temperature: 0.7,
        max_tokens: 1000,
        stream: true
      });

      let response = '';
      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || '';
        response += content;
      }
      
      return response;
    }
    
    throw new Error('Failed to generate response');
  }
}