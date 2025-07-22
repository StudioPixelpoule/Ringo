import { supabase } from './supabase';
import { ChatMessage, generateChatResponse as generateLocal, generateChatResponseStreaming as generateStreamingLocal } from './openai';

// Drapeau pour activer progressivement le chat sécurisé
const USE_SECURE_CHAT = false; // Désactivé pour l'instant

export async function generateChatResponseSecure(
  messages: ChatMessage[],
  documentContent?: string
): Promise<string> {
  if (!USE_SECURE_CHAT) {
    // Utiliser la fonction locale existante
    return generateLocal(messages, documentContent);
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Non authentifié');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-chat`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages, documentContent })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de la génération de la réponse');
    }

    const { response: chatResponse } = await response.json();
    return chatResponse;
  } catch (error) {
    console.error('Erreur avec l\'Edge Function, fallback sur traitement local:', error);
    // Fallback sur le traitement local
    return generateLocal(messages, documentContent);
  }
}

export async function generateChatResponseStreamingSecure(
  messages: ChatMessage[],
  documentContent?: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  if (!USE_SECURE_CHAT) {
    // Utiliser la fonction locale existante
    return generateStreamingLocal(messages, documentContent, onChunk);
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Non authentifié');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-chat-stream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages, documentContent })
      }
    );

    if (!response.ok) {
      throw new Error('Erreur lors de la génération de la réponse');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    if (!reader) {
      throw new Error('Pas de reader disponible');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            break;
          }
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullResponse += parsed.content;
              onChunk(parsed.content);
            }
          } catch (e) {
            // Ignorer les erreurs de parsing
          }
        }
      }
    }

    return fullResponse;
  } catch (error) {
    console.error('Erreur avec l\'Edge Function, fallback sur traitement local:', error);
    // Fallback sur le traitement local
    return generateStreamingLocal(messages, documentContent, onChunk);
  }
}

// Export pour remplacer progressivement
export { generateChatResponseSecure as generateChatResponse };
export { generateChatResponseStreamingSecure as generateChatResponseStreaming }; 