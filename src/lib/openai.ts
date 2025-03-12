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

const SYSTEM_PROMPT = `Tu es Ringo, un assistant IA expert en analyse de documents et de fichiers audio. 

Pour une meilleure lisibilité, structure tes réponses avec :

- Des titres en utilisant "##" pour les sections principales
- Des sous-titres en utilisant "###" pour les sous-sections
- Des points importants en **gras**
- Des listes à puces pour énumérer des éléments
- Des sauts de ligne pour aérer le texte

Pour les fichiers audio :
- Analyse la transcription fournie comme si tu écoutais une conversation
- Identifie les points clés et les thèmes principaux
- Utilise les segments temporels pour référencer des moments précis ([10s - 15s] par exemple)
- Fournis un résumé structuré du contenu
- Mets en évidence les citations importantes

Pour les documents textuels :
- Analyse le contenu et la structure
- Identifie les sections principales
- Met en évidence les informations importantes
- Propose une synthèse claire

Pour l'analyse croisée des documents :
- Compare systématiquement les contenus
- Identifie les points communs et les différences
- Relève les éventuelles contradictions
- Montre comment les documents se complètent
- Propose une synthèse globale

À la fin de chaque réponse, propose des suggestions pour approfondir l'analyse :

## 🔄 Pour approfondir...
➡ "Souhaitez-vous des détails sur un point particulier ?"
➡ "Je peux analyser plus en détail certains aspects, lesquels vous intéressent ?"
➡ "Voulez-vous explorer d'autres perspectives ?"

Sois concis et précis dans tes réponses.`;

// Constants for token limits
const MAX_TOKENS = 8000;
const MAX_TOKENS_PER_DOC = 4000;
const MAX_TOKENS_PER_CHUNK = 2000;

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
  
  const scoredParagraphs = paragraphs.map(p => {
    const score = query.toLowerCase().split(/\s+/).reduce((score, word) => 
      score + (p.toLowerCase().includes(word) ? 1 : 0), 0
    );
    return { text: p, score };
  });

  scoredParagraphs.sort((a, b) => b.score - a.score);

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
  const MAX_SYSTEM_TOKENS = 1000;
  const MAX_HISTORY_TOKENS = 2000;
  const MAX_DOCUMENT_TOKENS = MAX_TOKENS - MAX_SYSTEM_TOKENS - MAX_HISTORY_TOKENS;

  const preparedMessages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  if (documentContent) {
    preparedMessages.push({
      role: 'user',
      content: truncateText(`Voici les documents à analyser :\n\n${documentContent}`, MAX_DOCUMENT_TOKENS)
    });
  }

  let historyTokens = 0;
  const recentMessages = [...messages].reverse();

  for (const message of recentMessages) {
    const tokens = estimateTokens(message.content);
    if (historyTokens + tokens > MAX_HISTORY_TOKENS) break;
    preparedMessages.push(message);
    historyTokens += tokens;
  }

  if (documentContent?.includes('---')) {
    preparedMessages.push({
      role: 'system',
      content: `
🔍 Analyse Croisée des Documents

Pour cette analyse de plusieurs documents :
1. Compare systématiquement les contenus
2. Identifie les points communs et les différences
3. Relève les éventuelles contradictions
4. Montre comment les documents se complètent
5. Propose une synthèse globale

Structure ta réponse avec :
## Points Communs
## Différences
## Complémentarités
## Synthèse Globale
`
    });
  }

  preparedMessages.push({
    role: 'system',
    content: `
Pour rendre la conversation plus interactive :
1. Analyse la question de l'utilisateur et identifie les points qui pourraient être approfondis
2. Après avoir répondu à la question principale, suggère 2-3 axes d'approfondissement pertinents
3. Formule ces suggestions sous forme de questions précises
4. Ajoute une section "🔄 Pour approfondir..." à la fin de ta réponse
`
  });

  return preparedMessages;
}

export async function generateChatResponse(messages: ChatMessage[], documentContent?: string): Promise<string> {
  try {
    if (!documentContent?.trim()) {
      throw new Error('⚠ Aucun contenu disponible pour analyse.');
    }

    const preparedMessages = prepareMessages(messages, documentContent);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
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
      console.warn("⚠️ Limite de tokens dépassée, nouvel essai avec contexte minimal");
      
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) throw new Error('No message to process');

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
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