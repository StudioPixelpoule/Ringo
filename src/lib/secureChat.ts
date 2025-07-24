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

    console.log(`[SecureChat] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SecureChat] Error response: ${errorText}`);
      throw new Error(`Erreur lors de la génération de la réponse: ${response.status}`);
    }

    // Log le modèle utilisé si disponible dans les headers
    const modelUsed = response.headers.get('X-Model-Used');
    const modelReason = response.headers.get('X-Model-Reason');
    if (useHybrid && modelUsed) {
      console.log(`[SecureChat] Streaming with model: ${modelUsed} - Reason: ${modelReason}`);
      
      // Log spécial pour les bascules transparentes
      if (modelReason?.includes('transparente')) {
        console.log(`[SecureChat] ✅ Bascule transparente effectuée - L'utilisateur ne voit aucune différence`);
      }
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let chunkCount = 0;

    if (!reader) {
      throw new Error('Pas de reader disponible');
    }

    console.log('[SecureChat] Starting to read stream...');

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log(`[SecureChat] Stream completed. Total chunks: ${chunkCount}`);
        break;
      }
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            console.log('[SecureChat] Received [DONE] signal');
            break;
          }
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              console.error('[SecureChat] Stream error:', parsed.error);
              // Si c'est une erreur de surcharge, on continue à essayer de lire le stream
              // car le backend devrait avoir fait un fallback
              if (parsed.error.includes && (parsed.error.includes('529') || parsed.error.includes('Overloaded'))) {
                console.log('[SecureChat] Detected overload error, waiting for fallback...');
                continue;
              }
              // Pour les autres erreurs, on affiche le message
              onChunk(`\n\n❌ ${parsed.error}\n\n`);
              fullResponse = parsed.error;
              break;
            }
            if (parsed.content) {
              chunkCount++;
              fullResponse += parsed.content;
              onChunk(parsed.content);
            }
          } catch (e) {
            console.warn('[SecureChat] Failed to parse chunk:', data, e);
            // Ignorer les erreurs de parsing non critiques
          }
        }
      }
    }

    console.log(`[SecureChat] Full response length: ${fullResponse.length} characters`);
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