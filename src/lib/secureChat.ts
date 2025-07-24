import { supabase } from './supabase';
import { ChatMessage, generateChatResponse as generateLocal, generateChatResponseStreaming as generateStreamingLocal } from './openai';
import { FEATURE_FLAGS } from './constants';

// Chat sécurisé activé pour protéger la clé API
const USE_SECURE_CHAT = true; // Activé pour la sécurité

// Fonction pour déterminer si utiliser le mode hybride
function shouldUseHybridMode(documentCount: number = 0): boolean {
  // Si le feature flag est activé et qu'on a plus de documents que le seuil
  return FEATURE_FLAGS.USE_HYBRID_MODE && documentCount > FEATURE_FLAGS.HYBRID_MODE_DOCUMENT_THRESHOLD;
}

// Fonction pour compter les documents dans le contexte
function countDocuments(documentContent?: string): number {
  if (!documentContent) return 0;
  return (documentContent.match(/====== DOCUMENT ACTIF/g) || []).length;
}

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

    // Déterminer quel endpoint utiliser
    const documentCount = countDocuments(documentContent);
    const useHybrid = shouldUseHybridMode(documentCount);
    const endpoint = useHybrid ? 'process-chat-hybrid' : 'process-chat';

    console.log(`[SecureChat] Using ${endpoint} (${documentCount} documents)`);

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          messages, 
          documentContent,
          stream: false // Mode non-streaming
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de la génération de la réponse');
    }

    const data = await response.json();
    
    // Log le modèle utilisé si mode hybride
    if (useHybrid && data.model) {
      console.log(`[SecureChat] Model used: ${data.model} - Reason: ${data.reason}`);
    }
    
    return data.response;
  } catch (error) {
    console.error('Erreur avec l\'Edge Function, fallback sur traitement local:', error);
    // Fallback sur le traitement local
    return generateLocal(messages, documentContent);
  }
}

export async function generateChatResponseStreamingSecure(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  documentContent?: string
): Promise<string> {
  if (!USE_SECURE_CHAT) {
    // Utiliser la fonction locale existante
    return generateStreamingLocal(messages, onChunk, documentContent);
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Non authentifié');
    }

    // Déterminer quel endpoint utiliser
    const documentCount = countDocuments(documentContent);
    const useHybrid = shouldUseHybridMode(documentCount);
    const endpoint = useHybrid ? 'process-chat-hybrid' : 'process-chat-stream';

    console.log(`[SecureChat] Streaming with ${endpoint} (${documentCount} documents)`);

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          messages, 
          documentContent,
          stream: true // Mode streaming
        })
      }
    );

    if (!response.ok) {
      throw new Error('Erreur lors de la génération de la réponse');
    }

    // Log le modèle utilisé si disponible dans les headers
    const modelUsed = response.headers.get('X-Model-Used');
    const modelReason = response.headers.get('X-Model-Reason');
    if (useHybrid && modelUsed) {
      console.log(`[SecureChat] Streaming with model: ${modelUsed} - Reason: ${modelReason}`);
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
    return generateStreamingLocal(messages, onChunk, documentContent);
  }
}

// Export pour remplacer progressivement
export { generateChatResponseSecure as generateChatResponse };
export { generateChatResponseStreamingSecure as generateChatResponseStreaming }; 