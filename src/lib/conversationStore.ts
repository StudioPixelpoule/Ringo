import { create } from 'zustand';
import { supabase } from './supabase';
import { generateChatResponseStreamingSecure } from './secureChat';
import { processDocument } from './universalProcessor';
import { Document } from './documentStore';
import { logger } from './logger';
import { MAX_DOCUMENTS_PER_CONVERSATION, ERROR_MESSAGES, FEATURE_FLAGS, MAX_TOKENS, MAX_TOKENS_CLAUDE } from './constants';
import { compressDocuments, extractKeywordsFromQuery } from './documentCompressor';

// Fonction pour estimer le nombre total de tokens dans les documents
const estimateTotalTokens = (documents: string[]): number => {
  return documents.reduce((total, doc) => {
    // Estimation approximative : 1 token ≈ 4 caractères
    return total + Math.ceil(doc.length / 4);
  }, 0);
};

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  user_id: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ConversationDocument {
  id: string;
  conversation_id: string;
  document_id: string;
  created_at: string;
  documents: Document;
}

interface ConversationStore {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  documents: ConversationDocument[];
  loading: boolean;
  error: string | null;
  isTyping: boolean;
  streamedMessages: Set<string>;

  fetchConversations: () => Promise<void>;
  createConversation: (title: string) => Promise<Conversation>;
  createConversationWithDocument: (document: Document, skipMessage?: boolean) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  setCurrentConversation: (conversation: Conversation | null) => void;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  linkDocument: (documentId: string) => Promise<void>;
  linkDocumentSilently: (documentId: string) => Promise<void>;
  linkMultipleDocuments: (documentIds: string[]) => Promise<{ success: boolean; addedCount: number; errors: string[] }>;
  unlinkDocument: (documentId: string) => Promise<void>;
  fetchConversationDocuments: (conversationId: string) => Promise<void>;
  markMessageAsStreamed: (messageId: string) => void;
  clearError: () => void;
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  documents: [],
  loading: false,
  error: null,
  isTyping: false,
  streamedMessages: new Set<string>(),

  fetchConversations: async () => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ conversations: data || [] });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error fetching conversations' });
    } finally {
      set({ loading: false });
    }
  },

  createConversation: async (title) => {
    set({ loading: true, error: null });
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('conversations')
        .insert([{ 
          title,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) throw error;
      
      const conversations = get().conversations;
      set({ conversations: [data, ...conversations] });
      
      return data;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error creating conversation' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  createConversationWithDocument: async (document, skipMessage = false) => {
    set({ loading: true, error: null });
    try {
      const conversation = await get().createConversation(document.name);
      
      const { error: linkError } = await supabase
        .from('conversation_documents')
        .insert([{
          conversation_id: conversation.id,
          document_id: document.id
        }]);

      if (linkError) throw linkError;
      
      set({ currentConversation: conversation });
      await get().fetchConversationDocuments(conversation.id);
      
      if (!skipMessage) {
        const { data: welcomeMessage, error: messageError } = await supabase
          .from('messages')
          .insert([{
            conversation_id: conversation.id,
            sender: 'assistant',
            content: `Bonjour, je suis Ringo ! Je vois que vous avez ajouté le document "${document.name}". Je suis prêt à analyser son contenu. Que souhaitez-vous savoir ?`
          }])
          .select()
          .single();

        if (messageError) throw messageError;
        set({ messages: [welcomeMessage] });
      } else {
        set({ messages: [] });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error creating conversation with document' });
    } finally {
      set({ loading: false });
    }
  },

  deleteConversation: async (id) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      const conversations = get().conversations;
      set({ 
        conversations: conversations.filter(c => c.id !== id),
        currentConversation: get().currentConversation?.id === id ? null : get().currentConversation,
        messages: get().currentConversation?.id === id ? [] : get().messages,
        documents: get().currentConversation?.id === id ? [] : get().documents
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error deleting conversation' });
    } finally {
      set({ loading: false });
    }
  },

  setCurrentConversation: (conversation) => {
    set({ currentConversation: conversation });
    if (conversation) {
      get().fetchMessages(conversation.id);
      get().fetchConversationDocuments(conversation.id);
    } else {
      set({ messages: [], documents: [] });
    }
  },

  updateConversationTitle: async (id, title) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ title })
        .eq('id', id);

      if (error) throw error;
      
      const conversations = get().conversations;
      set({
        conversations: conversations.map(c =>
          c.id === id ? { ...c, title } : c
        ),
        currentConversation: get().currentConversation && get().currentConversation!.id === id
          ? { ...get().currentConversation!, title }
          : get().currentConversation
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error updating conversation title' });
    } finally {
      set({ loading: false });
    }
  },

  fetchMessages: async (conversationId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      set({ messages: data || [] });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error fetching messages' });
    } finally {
      set({ loading: false });
    }
  },

  sendMessage: async (content) => {
    const conversation = get().currentConversation;
    if (!conversation) {
      set({ error: 'No conversation selected' });
      return;
    }

    set({ loading: true, error: null, isTyping: true });
    try {
      const { data: userMessage, error: userError } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversation.id,
          sender: 'user',
          content
        }])
        .select()
        .single();

      if (userError) throw userError;

      const messages = get().messages;
      set({ messages: [...messages, userMessage] });

      const chatHistory = get().messages.map(msg => ({
        role: msg.sender,
        content: msg.content
      }));

      const { data: conversationDocs } = await supabase
        .from('conversation_documents')
        .select(`
          id,
          conversation_id,
          document_id,
          created_at,
          documents:document_id (
            id,
            name,
            type,
            url,
            description,
            group_name,
            processed
          )
        `)
        .eq('conversation_id', conversation.id) as { 
          data: Array<{
            id: string;
            conversation_id: string;
            document_id: string;
            created_at: string;
            documents: {
              id: string;
              name: string;
              type: string;
              url: string;
              description?: string;
              group_name?: string;
              processed: boolean;
            }
          }> | null;
          error: any;
        };

      if (!conversationDocs?.length) {
        throw new Error('Aucun document disponible pour analyse');
      }

      const formattedDocuments = await Promise.all(
        conversationDocs
          .map(docWrapper => docWrapper.documents)
          .filter(Boolean)
          .map(async (doc: any) => {
            // Fetch document content safely with error handling
            let documentContent = '';
            try {
              const { data: contentData, error: contentError } = await supabase
                .from('document_contents')
                .select('content')
                .eq('document_id', doc.id)
                .maybeSingle(); // Use maybeSingle instead of single to avoid 406 errors
              
              if (contentError) {
                console.error('Error fetching document content:', contentError);
                return `
====== DOCUMENT ACTIF "${doc.name}" ======
TITRE: ${doc.name}
TYPE: ${doc.type}
${doc.description ? `DESCRIPTION: ${doc.description}` : ''}

CONTENU:
[Erreur lors de la récupération du contenu]

====== FIN DU DOCUMENT "${doc.name}" ======

INSTRUCTION IMPORTANTE: Le contenu de ce document n'a pas pu être récupéré. Utilise uniquement les autres documents disponibles dans cette conversation.
`;
              }
              
              documentContent = contentData?.content || '';
            } catch (error) {
              console.error('Error processing document content:', error);
              return `
====== DOCUMENT ACTIF "${doc.name}" ======
TITRE: ${doc.name}
TYPE: ${doc.type}
${doc.description ? `DESCRIPTION: ${doc.description}` : ''}

CONTENU:
[Erreur lors du traitement du contenu]

====== FIN DU DOCUMENT "${doc.name}" ======

INSTRUCTION IMPORTANTE: Le contenu de ce document n'a pas pu être traité. Utilise uniquement les autres documents disponibles dans cette conversation.
`;
            }

            // Pour les fichiers audio, vérifier si des informations spécifiques sont disponibles
            if (doc.type === 'audio' && documentContent) {
              const audioDescription = doc.group_name; // Récupérer la description audio spécifique
              
              try {
                // Vérifier si le contenu est un JSON valide avant de le parser
                if (documentContent.trim().startsWith('{') && documentContent.trim().endsWith('}')) {
                  const audioData = JSON.parse(documentContent);
                  
                  // Vérifier si la description audio est déjà incluse dans le contenu
                  const hasAudioDescription = 
                    (typeof audioData.content === 'string' && audioData.content.includes("== CONTEXTE DE L'ENREGISTREMENT ==")) || 
                    (audioData.metadata && audioData.metadata.audioDescription === audioDescription);
                  
                  if (!hasAudioDescription && audioDescription) {
                    // Si pas déjà présente et fournie, ajouter au contenu du document
                    if (audioData.metadata) {
                      audioData.metadata.audioDescription = audioDescription;
                    }
                    
                    // Formater de manière plus explicite pour l'IA
                    if (typeof audioData.content === 'string') {
                      audioData.content = `== CONTEXTE DE L'ENREGISTREMENT ==\n${audioDescription}\n\n== TRANSCRIPTION ==\n${audioData.content}`;
                    }
                    
                    // Mettre à jour le contenu
                    documentContent = JSON.stringify(audioData);
                  }
                } else {
                  // Si ce n'est pas un JSON valide mais qu'il y a une description audio, l'ajouter manuellement
                  if (audioDescription) {
                    documentContent = `== CONTEXTE DE L'ENREGISTREMENT ==\n${audioDescription}\n\n== TRANSCRIPTION ==\n${documentContent}`;
                  }
                }
              } catch (e) {
                // Si erreur de parsing, ajouter la description audio manuellement si disponible
                console.error('Erreur de parsing du contenu audio:', e);
                if (audioDescription) {
                  documentContent = `== CONTEXTE DE L'ENREGISTREMENT ==\n${audioDescription}\n\n== TRANSCRIPTION ==\n${documentContent}`;
                }
              }
            }
            
            // Pour les fichiers de données (JSON, CSV), formater de manière plus lisible
            if (doc.type === 'data' && documentContent) {
              try {
                // Vérifier si le contenu est déjà un objet (peut arriver en production)
                let dataContent = documentContent;
                
                // Si c'est une chaîne, essayer de la parser
                if (typeof documentContent === 'string' && 
                    documentContent.trim().startsWith('{') && 
                    documentContent.trim().endsWith('}')) {
                  try {
                    dataContent = JSON.parse(documentContent);
                  } catch (parseError) {
                    console.warn('Impossible de parser le JSON, utilisation du contenu brut:', parseError);
                    // Si le parsing échoue, on garde le contenu tel quel
                  }
                }
                
                // Si dataContent est maintenant un objet, on peut continuer
                if (typeof dataContent === 'object' && dataContent !== null) {
                  
                  // Si c'est un fichier de données traité par notre système (avec type et data)
                  if (dataContent.type && dataContent.data) {
                    const dataInfo = dataContent.metadata || {};
                    
                    // Créer un résumé structuré des données
                    let formattedContent = `== DONNÉES STRUCTURÉES ==\n`;
                    formattedContent += `Type de fichier: ${dataContent.type.toUpperCase()}\n`;
                    formattedContent += `Nom du fichier: ${dataContent.fileName}\n`;
                    
                    if (dataInfo.rowCount !== undefined) {
                      formattedContent += `Nombre d'enregistrements: ${dataInfo.rowCount}\n`;
                    }
                    
                    if (dataInfo.fields && dataInfo.fields.length > 0) {
                      formattedContent += `Colonnes/Champs: ${dataInfo.fields.join(', ')}\n`;
                    }
                    
                    formattedContent += `\n== CONTENU DES DONNÉES ==\n`;
                    
                    // Pour les tableaux de données, limiter l'affichage aux premiers enregistrements
                    if (Array.isArray(dataContent.data)) {
                      const sampleSize = Math.min(5, dataContent.data.length);
                      formattedContent += `(Affichage des ${sampleSize} premiers enregistrements sur ${dataContent.data.length})\n\n`;
                      formattedContent += JSON.stringify(dataContent.data.slice(0, sampleSize), null, 2);
                      
                      if (dataContent.data.length > sampleSize) {
                        formattedContent += `\n\n... ${dataContent.data.length - sampleSize} enregistrements supplémentaires non affichés ...\n`;
                        formattedContent += `\nPour une analyse complète, pose des questions spécifiques sur les données.`;
                      }
                    } else {
                      // Pour les objets JSON simples, afficher de manière formatée
                      formattedContent += JSON.stringify(dataContent.data, null, 2);
                    }
                    
                    // Remplacer le contenu par la version formatée
                    documentContent = formattedContent;
                  } else if (!dataContent.type) {
                    // C'est un fichier JSON brut (non traité par notre système)
                    // Analyser la structure pour créer un résumé intelligent
                    let formattedContent = `== DONNÉES JSON STRUCTURÉES ==\n`;
                    formattedContent += `Nom du fichier: ${doc.name}\n`;
                    
                    // Analyser la structure du JSON
                    const keys = Object.keys(dataContent);
                    formattedContent += `Clés principales: ${keys.slice(0, 10).join(', ')}${keys.length > 10 ? '...' : ''}\n`;
                    
                    // Compter les éléments si c'est un tableau
                    if (Array.isArray(dataContent)) {
                      formattedContent += `Type: Tableau\n`;
                      formattedContent += `Nombre d'éléments: ${dataContent.length}\n`;
                      if (dataContent.length > 0 && typeof dataContent[0] === 'object') {
                        const firstItemKeys = Object.keys(dataContent[0]);
                        formattedContent += `Structure des éléments: ${firstItemKeys.join(', ')}\n`;
                      }
                    } else if (typeof dataContent === 'object') {
                      formattedContent += `Type: Objet\n`;
                      // Analyser la structure imbriquée
                      let totalItems = 0;
                      let structureInfo = [];
                      
                      for (const key of keys) {
                        const value = dataContent[key];
                        if (Array.isArray(value)) {
                          structureInfo.push(`${key}: tableau de ${value.length} éléments`);
                          totalItems += value.length;
                        } else if (typeof value === 'object' && value !== null) {
                          const subKeys = Object.keys(value);
                          structureInfo.push(`${key}: objet avec ${subKeys.length} propriétés`);
                          totalItems += subKeys.length;
                        }
                      }
                      
                      if (structureInfo.length > 0) {
                        formattedContent += `\nStructure détaillée:\n`;
                        structureInfo.slice(0, 10).forEach(info => {
                          formattedContent += `  - ${info}\n`;
                        });
                        if (structureInfo.length > 10) {
                          formattedContent += `  ... et ${structureInfo.length - 10} autres sections\n`;
                        }
                      }
                    }
                    
                    formattedContent += `\n== CONTENU COMPLET ==\n`;
                    
                    // Limiter la taille du contenu affiché
                    const jsonString = JSON.stringify(dataContent, null, 2);
                    const maxLength = 50000; // Limiter à 50000 caractères
                    
                    if (jsonString.length > maxLength) {
                      // Pour les gros fichiers, afficher un échantillon
                      formattedContent += `(Fichier volumineux - ${Math.round(jsonString.length / 1000)}KB - affichage partiel)\n\n`;
                      formattedContent += jsonString.substring(0, maxLength);
                      formattedContent += `\n\n... Contenu tronqué (${Math.round((jsonString.length - maxLength) / 1000)}KB supplémentaires) ...\n`;
                      formattedContent += `\n💡 Ce fichier JSON est très volumineux. Pour une analyse efficace:\n`;
                      formattedContent += `- Pose des questions spécifiques sur les sections qui t'intéressent\n`;
                      formattedContent += `- Demande des extractions ciblées de données\n`;
                      formattedContent += `- Utilise des filtres pour réduire les données affichées`;
                    } else {
                      formattedContent += jsonString;
                    }
                    
                    // Remplacer le contenu par la version formatée
                    documentContent = formattedContent;
                  }
                }
              } catch (e) {
                // Si erreur de parsing, garder le contenu original
                console.error('Erreur lors du formatage des données:', e);
                // Mais essayer quand même de donner des infos basiques
                documentContent = `== FICHIER DE DONNÉES ==\nNom: ${doc.name}\nType: ${doc.type}\n\nNote: Le contenu de ce fichier n'a pas pu être analysé automatiquement.\n\n${documentContent}`;
              }
            }

            return `
====== DOCUMENT ACTIF "${doc.name}" ======
TITRE: ${doc.name}
TYPE: ${doc.type}
${doc.description ? `DESCRIPTION: ${doc.description}` : ''}
${doc.type === 'audio' && doc.group_name ? `CONTEXTE AUDIO: ${doc.group_name}` : ''}

CONTENU:
${documentContent}

====== FIN DU DOCUMENT "${doc.name}" ======

INSTRUCTION IMPORTANTE: Tu dois UNIQUEMENT utiliser les informations contenues dans ce document et les autres documents de cette conversation.
NE PAS faire référence à des documents externes ou d'autres conversations.
`;
          })
      );

      // Appliquer la compression intelligente si nécessaire
      let processedDocuments = formattedDocuments;
      
      // Vérifier si la compression est nécessaire
      const shouldCompress = !FEATURE_FLAGS.DISABLE_COMPRESSION || 
        (FEATURE_FLAGS.DISABLE_COMPRESSION && estimateTotalTokens(formattedDocuments) > 
          (FEATURE_FLAGS.USE_HYBRID_MODE && formattedDocuments.length > FEATURE_FLAGS.HYBRID_MODE_DOCUMENT_THRESHOLD 
            ? MAX_TOKENS_CLAUDE * FEATURE_FLAGS.ADAPTIVE_COMPRESSION_THRESHOLD 
            : MAX_TOKENS * FEATURE_FLAGS.ADAPTIVE_COMPRESSION_THRESHOLD));
      
      if (shouldCompress && formattedDocuments.length > 4) {
        logger.info(`📊 Compression adaptative activée pour ${formattedDocuments.length} documents`);
        
        // Extraire le contenu structuré pour la compression
        const docsForCompression = formattedDocuments.map(docStr => {
          // Extraire le nom du document
          const nameMatch = docStr.match(/====== DOCUMENT ACTIF "([^"]+)" ======/);
          const name = nameMatch ? nameMatch[1] : 'Document sans nom';
          
          // Extraire le contenu entre CONTENU: et FIN DU DOCUMENT
          const contentMatch = docStr.match(/CONTENU:\n([\s\S]*?)\n====== FIN DU DOCUMENT/);
          const content = contentMatch ? contentMatch[1].trim() : docStr;
          
          return { name, content };
        });
        
        // Extraire les mots-clés de la requête pour prioriser le contenu
        const queryKeywords = extractKeywordsFromQuery(content);
        
        // Compresser les documents
        const compressedDocs = compressDocuments(docsForCompression, formattedDocuments.length);
        
        // Reformater les documents compressés
        processedDocuments = compressedDocs.map((doc, index) => {
          const docWrapper = conversationDocs?.find(d => d.documents?.name === doc.name);
          const originalDoc = docWrapper?.documents;
          
          const compressionNote = doc.compressed 
            ? `\n[Note: Document compressé de ${doc.originalTokens} à ${doc.compressedTokens} tokens pour optimiser le traitement]` 
            : '';
          
          return `
====== DOCUMENT ACTIF "${doc.name}" ======
TITRE: ${doc.name}
TYPE: ${originalDoc?.type || 'document'}
${originalDoc?.description ? `DESCRIPTION: ${originalDoc.description}` : ''}
${originalDoc?.type === 'audio' && originalDoc?.group_name ? `CONTEXTE AUDIO: ${originalDoc.group_name}` : ''}${compressionNote}

CONTENU:
${doc.content}

====== FIN DU DOCUMENT "${doc.name}" ======

INSTRUCTION IMPORTANTE: Tu dois UNIQUEMENT utiliser les informations contenues dans ce document et les autres documents de cette conversation.
NE PAS faire référence à des documents externes ou d'autres conversations.
`;
        });
        
        logger.info(`✅ Compression terminée: ${compressedDocs.filter(d => d.compressed).length} documents compressés`);
      }

      const documentContext = processedDocuments.join('\n\n---\n\n');
      
      // Ajouter une instruction claire au début du contexte
      const enhancedDocumentContext = `
CONTEXTE ISOLÉ - CONVERSATION ${conversation.id}
=====================================
Tu as accès UNIQUEMENT aux ${processedDocuments.length} document(s) suivants pour cette conversation.
INTERDICTION de faire référence à tout autre document non listé ci-dessous.

${processedDocuments.length > 1 ? `
INSTRUCTIONS POUR ANALYSE MULTI-DOCUMENTS :
- Compare et croise les informations entre TOUS les documents
- Identifie les points communs et les différences
- Synthétise les informations complémentaires
- Cite toujours la source (nom du document) pour chaque information importante
- Si demandé, crée des tableaux comparatifs ou des synthèses consolidées
` : ''}

${documentContext}

=====================================
FIN DU CONTEXTE ISOLÉ

RAPPEL: Utilise UNIQUEMENT les documents ci-dessus. Si une information n'est pas présente dans ces documents, indique clairement que tu ne peux pas répondre avec les documents fournis.`;

      // Create empty assistant message first
      const { data: aiMessage, error: aiError } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversation.id,
          sender: 'assistant',
          content: ''
        }])
        .select()
        .single();

      if (aiError) throw aiError;

      // Add empty message to state
      set({ messages: [...get().messages, aiMessage] });

      // Stream the response
      let streamedContent = '';
      
      try {
        streamedContent = await generateChatResponseStreamingSecure(
          [...chatHistory, { role: 'user', content }],
          (chunk) => {
            streamedContent += chunk;
            set(state => ({
              messages: state.messages.map(msg => 
                msg.id === aiMessage.id 
                  ? { ...msg, content: streamedContent }
                  : msg
              )
            }));
          },
          enhancedDocumentContext
        );

        // Update final message with complete content
        await supabase
          .from('messages')
          .update({ content: streamedContent })
          .eq('id', aiMessage.id);

      } catch (streamError: any) {
        console.error('Error streaming response:', streamError);
        
        // Mettre à jour le message avec l'erreur
        let errorMessage = ERROR_MESSAGES.GENERIC_ERROR;
        
        // Vérifier si c'est une erreur de limite de taux
        if (streamError?.status === 429 || streamError?.message?.includes('rate limit')) {
          errorMessage = ERROR_MESSAGES.RATE_LIMIT;
        }
        // Vérifier si c'est une erreur de limite de tokens
        else if (streamError?.message?.includes('tokens') || streamError?.message?.includes('context')) {
          errorMessage = ERROR_MESSAGES.TOKEN_LIMIT;
        }
        
        const errorContent = `${errorMessage}\n\n*Erreur technique: ${streamError.message}*`;
        
        set(state => ({
          messages: state.messages.map(msg => 
            msg.id === aiMessage.id 
              ? { ...msg, content: errorContent }
              : msg
          )
        }));
        
        await supabase
          .from('messages')
          .update({ content: errorContent })
          .eq('id', aiMessage.id);
        
        throw streamError;
      }

      // Mark message as streamed
      get().markMessageAsStreamed(aiMessage.id);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error sending message' });
    } finally {
      set({ loading: false, isTyping: false });
    }
  },

  linkDocument: async (documentId) => {
    const conversation = get().currentConversation;
    if (!conversation) {
      set({ error: 'No conversation selected' });
      return;
    }

    set({ loading: true, error: null });
    try {
      // Vérifier la limite de documents
      const currentDocCount = get().documents.length;
      
      if (currentDocCount >= MAX_DOCUMENTS_PER_CONVERSATION) {
        throw new Error(ERROR_MESSAGES.DOCUMENT_LIMIT);
      }
      
      // Check if document is already linked
      const { data: existingLink } = await supabase
        .from('conversation_documents')
        .select('id')
        .eq('conversation_id', conversation.id)
        .eq('document_id', documentId)
        .maybeSingle();

      if (existingLink) {
        throw new Error('Ce document est déjà lié à la conversation');
      }

      const { error } = await supabase
        .from('conversation_documents')
        .insert([{
          conversation_id: conversation.id,
          document_id: documentId
        }]);

      if (error) throw error;
      
      await get().fetchConversationDocuments(conversation.id);

      const doc = get().documents.find(d => d.document_id === documentId);
      if (doc) {
        // Créer un message personnalisé selon le nombre de documents
        const totalDocs = get().documents.length + 1; // +1 car le nouveau doc n'est pas encore dans la liste
        let messageContent = `C'est Ringo ! J'ai bien reçu le document "${doc.documents.name}".`;
        
        if (totalDocs > 1) {
          messageContent += ` Je dispose maintenant de ${totalDocs} documents dans cette conversation.`;
          messageContent += `\n\n**Suggestions d'analyse multi-documents :**`;
          messageContent += `\n- Comparer les informations entre les documents`;
          messageContent += `\n- Créer une synthèse consolidée`;
          messageContent += `\n- Identifier les points communs et différences`;
          messageContent += `\n- Générer un tableau comparatif`;
          messageContent += `\n\nQue souhaitez-vous que j'analyse ?`;
        } else {
          messageContent += ` Je suis prêt à l'analyser. Que souhaitez-vous savoir ?`;
        }
        
        const { data: acknowledgmentMessage, error: messageError } = await supabase
          .from('messages')
          .insert([{
            conversation_id: conversation.id,
            sender: 'assistant',
            content: messageContent
          }])
          .select()
          .single();

        if (messageError) throw messageError;
        set({ messages: [...get().messages, acknowledgmentMessage] });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error linking document' });
    } finally {
      set({ loading: false });
    }
  },

  linkDocumentSilently: async (documentId) => {
    const conversation = get().currentConversation;
    logger.info(`linkDocumentSilently appelé avec documentId: ${documentId} (type: ${typeof documentId})`);
    
    if (!conversation) {
      set({ error: 'No conversation selected' });
      return;
    }

    try {
      // Vérifier la limite de documents
      const currentDocCount = get().documents.length;
      
      if (currentDocCount >= MAX_DOCUMENTS_PER_CONVERSATION) {
        throw new Error(ERROR_MESSAGES.DOCUMENT_LIMIT);
      }
      
      // Vérifier que le document existe
      const { data: documentExists, error: checkError } = await supabase
        .from('documents')
        .select('id')
        .eq('id', documentId)
        .maybeSingle();
        
      if (checkError) {
        logger.error(`Erreur lors de la vérification du document ${documentId}:`, checkError);
        throw new Error(`Erreur lors de la vérification du document: ${checkError.message}`);
      }
        
      if (!documentExists) {
        logger.error(`Document ${documentId} n'existe pas dans la base de données`);
        throw new Error(`Le document avec l'ID ${documentId} n'existe pas`);
      }
      
      logger.info(`Document ${documentId} trouvé, vérification du lien existant...`);
      
      // Check if document is already linked
      const { data: existingLink } = await supabase
        .from('conversation_documents')
        .select('id')
        .eq('conversation_id', conversation.id)
        .eq('document_id', documentId)
        .maybeSingle();

      if (existingLink) {
        logger.info(`Document ${documentId} déjà lié à la conversation ${conversation.id}`);
        throw new Error('Ce document est déjà lié à la conversation');
      }

      logger.info(`Liaison du document ${documentId} à la conversation ${conversation.id}...`);

      const { error } = await supabase
        .from('conversation_documents')
        .insert([{
          conversation_id: conversation.id,
          document_id: documentId
        }]);

      if (error) {
        logger.error(`Erreur lors de l'insertion dans conversation_documents pour ${documentId}:`, error);
        logger.error('Détails:', { conversation_id: conversation.id, document_id: documentId });
        throw error;
      }
      
      logger.success(`Document ${documentId} lié avec succès`);
      
      await get().fetchConversationDocuments(conversation.id);
    } catch (error) {
      throw error;
    }
  },

  linkMultipleDocuments: async (documentIds) => {
    const conversation = get().currentConversation;
    if (!conversation) {
      set({ error: 'No conversation selected' });
      return { success: false, addedCount: 0, errors: [] };
    }

    // Limiter le nombre de documents pour éviter les problèmes de tokens
    const currentDocCount = get().documents.length;
    
    logger.info(`Tentative d'ajout de ${documentIds.length} documents. Documents actuels: ${currentDocCount}`);
    
    if (currentDocCount + documentIds.length > MAX_DOCUMENTS_PER_CONVERSATION) {
      const availableSlots = Math.max(0, MAX_DOCUMENTS_PER_CONVERSATION - currentDocCount);
      if (availableSlots === 0) {
        set({ error: ERROR_MESSAGES.DOCUMENT_LIMIT });
        return { 
          success: false, 
          addedCount: 0, 
          errors: [ERROR_MESSAGES.DOCUMENT_LIMIT] 
        };
      } else {
        // Limiter les documents à ajouter
        documentIds = documentIds.slice(0, availableSlots);
        logger.warn(`Limitation à ${availableSlots} document(s) pour respecter la limite de ${MAX_DOCUMENTS_PER_CONVERSATION} par conversation.`);
      }
    }

    set({ loading: true, error: null });
    
    const addedDocuments: string[] = [];
    const alreadyLinkedDocuments: string[] = [];
    const errors: string[] = [];
    
    try {
      // Vérifier d'abord quels documents sont déjà liés
      const { data: existingLinks } = await supabase
        .from('conversation_documents')
        .select('document_id')
        .eq('conversation_id', conversation.id)
        .in('document_id', documentIds);
      
      const existingDocumentIds = new Set(existingLinks?.map(link => link.document_id) || []);
      
      // Lier seulement les documents qui ne sont pas déjà liés
      for (const documentId of documentIds) {
        if (existingDocumentIds.has(documentId)) {
          alreadyLinkedDocuments.push(documentId);
          continue;
        }
        
        try {
          await get().linkDocumentSilently(documentId);
          addedDocuments.push(documentId);
        } catch (error: any) {
          errors.push(`Erreur lors de l'ajout d'un document`);
          console.error('Error linking document:', error);
        }
      }
      
      // Rafraîchir la liste des documents
      await get().fetchConversationDocuments(conversation.id);
      const totalDocs = get().documents.length;
      
      logger.info(`Documents après rafraîchissement: ${totalDocs}`);
      logger.info(`Documents ajoutés: ${addedDocuments.length}, déjà liés: ${alreadyLinkedDocuments.length}, erreurs: ${errors.length}`);
      
      // Créer un message récapitulatif si on a des documents (ajoutés ou déjà présents)
      const messages = get().messages;
      const isNewConversation = messages.length === 0 || (messages.length === 1 && messages[0].content === '');
      
      if (isNewConversation) {
        // Pour une nouvelle conversation, créer un message récapitulatif avec TOUS les documents
        const allDocNames = get().documents
          .map(docWrapper => docWrapper.documents.name)
          .filter(Boolean);
        
        let messageContent = `Bonjour, je suis Ringo ! `;
        
        if (allDocNames.length === 0 && documentIds.length > 0) {
          // Aucun document n'a pu être ajouté
          messageContent += `\n\n⚠️ Aucun document n'a pu être ajouté. Les documents sélectionnés n'existent pas ou ne sont pas accessibles.\n\nPour importer des documents :\n1. Utilisez le bouton "Importer un document" pour téléverser de nouveaux fichiers\n2. Ou sélectionnez des documents déjà importés dans l'explorateur`;
        } else if (allDocNames.length === 0) {
          messageContent += `Je suis prêt à analyser vos documents. Importez des fichiers pour commencer !`;
        } else if (allDocNames.length === 1) {
          messageContent += `J'ai bien reçu le document "${allDocNames[0]}".`;
        } else {
          messageContent += `J'ai bien reçu ${allDocNames.length} documents :`;
          allDocNames.forEach(name => {
            messageContent += `\n- ${name}`;
          });
        }
        
        if (totalDocs > 1) {
          messageContent += `\n\n**Suggestions d'analyse multi-documents :**`;
          messageContent += `\n- Comparer les informations entre les documents`;
          messageContent += `\n- Créer une synthèse consolidée`;
          messageContent += `\n- Identifier les points communs et différences`;
          messageContent += `\n- Générer un tableau comparatif`;
          messageContent += `\n\nQue souhaitez-vous que j'analyse ?`;
        } else {
          messageContent += ` Je suis prêt à l'analyser. Que souhaitez-vous savoir ?`;
        }
        
        const { data: acknowledgmentMessage, error: messageError } = await supabase
          .from('messages')
          .insert([{
            conversation_id: conversation.id,
            sender: 'assistant',
            content: messageContent
          }])
          .select()
          .single();

        if (messageError) throw messageError;
        set({ messages: [...get().messages, acknowledgmentMessage] });
      }
      // Si des documents ont été ajoutés ET qu'il y a déjà des messages, créer un message pour les nouveaux
      else if (addedDocuments.length > 0 && !isNewConversation) {
        // Récupérer les noms des documents ajoutés
        const addedDocNames = addedDocuments
          .map(id => get().documents.find(d => d.document_id === id))
          .filter(Boolean)
          .map(doc => doc!.documents.name);
        
        let messageContent = `C'est Ringo ! J'ai bien reçu `;
        
        if (addedDocuments.length === 1) {
          messageContent += `le document "${addedDocNames[0]}".`;
        } else {
          messageContent += `${addedDocuments.length} nouveaux documents :`;
          addedDocNames.forEach(name => {
            messageContent += `\n- ${name}`;
          });
        }
        
        messageContent += `\n\nJe dispose maintenant de ${totalDocs} documents dans cette conversation.`;
        messageContent += `\n\n**Suggestions d'analyse multi-documents :**`;
        messageContent += `\n- Comparer les informations entre tous les documents`;
        messageContent += `\n- Créer une synthèse consolidée`;
        messageContent += `\n- Identifier les points communs et différences`;
        messageContent += `\n- Générer un tableau comparatif`;
        messageContent += `\n\nQue souhaitez-vous que j'analyse ?`;
        
        const { data: acknowledgmentMessage, error: messageError } = await supabase
          .from('messages')
          .insert([{
            conversation_id: conversation.id,
            sender: 'assistant',
            content: messageContent
          }])
          .select()
          .single();

        if (messageError) throw messageError;
        set({ messages: [...get().messages, acknowledgmentMessage] });
      }
      
      return { 
        success: true, 
        addedCount: addedDocuments.length, 
        errors 
      };
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error linking documents' });
      return { success: false, addedCount: 0, errors: [error instanceof Error ? error.message : 'Erreur inconnue'] };
    } finally {
      set({ loading: false });
    }
  },

  unlinkDocument: async (documentId) => {
    const conversation = get().currentConversation;
    if (!conversation) {
      set({ error: 'No conversation selected' });
      return;
    }

    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('conversation_documents')
        .delete()
        .eq('conversation_id', conversation.id)
        .eq('document_id', documentId);

      if (error) throw error;
      
      // Update local state
      set(state => ({
        documents: state.documents.filter(d => d.document_id !== documentId)
      }));

      // Add system message about document removal
      const removedDoc = get().documents.find(d => d.document_id === documentId);
      if (removedDoc) {
        const { data: systemMessage, error: messageError } = await supabase
          .from('messages')
          .insert([{
            conversation_id: conversation.id,
            sender: 'assistant',
            content: `Le document "${removedDoc.documents.name}" a été retiré de la conversation. Je ne l'utiliserai plus pour mes réponses.`
          }])
          .select()
          .single();

        if (messageError) throw messageError;
        set({ messages: [...get().messages, systemMessage] });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error unlinking document' });
    } finally {
      set({ loading: false });
    }
  },

  fetchConversationDocuments: async (conversationId) => {
    set({ loading: true, error: null });
    logger.info(`Récupération des documents pour la conversation ${conversationId}`);
    
    try {
      const { data, error } = await supabase
        .from('conversation_documents')
        .select(`
          id,
          conversation_id,
          document_id,
          created_at,
          documents:document_id (
            id,
            name,
            type,
            url,
            description,
            group_name,
            processed,
            folder_id,
            created_at
          )
        `)
        .eq('conversation_id', conversationId) as { data: ConversationDocument[] | null, error: any };

      if (error) {
        logger.error(`Erreur lors de la récupération des documents:`, error);
        throw error;
      }
      
      logger.info(`Documents récupérés: ${data?.length || 0}`);
      set({ documents: data || [] });
    } catch (error) {
      logger.error(`Erreur dans fetchConversationDocuments:`, error);
      set({ error: error instanceof Error ? error.message : 'Error fetching conversation documents' });
    } finally {
      set({ loading: false });
    }
  },

  markMessageAsStreamed: (messageId) => {
    set(state => ({
      streamedMessages: new Set(state.streamedMessages).add(messageId)
    }));
  },

  clearError: () => set({ error: null }),
}));