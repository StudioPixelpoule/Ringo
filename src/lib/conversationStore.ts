import { create } from 'zustand';
import { supabase } from './supabase';
import { generateChatResponseSecure as generateChatResponse, generateChatResponseStreamingSecure as generateChatResponseStreaming } from './secureChat';
import { Document } from './documentStore';
import { MAX_DOCUMENTS_PER_CONVERSATION, ERROR_MESSAGES } from './constants';

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
        currentConversation: get().currentConversation?.id === id
          ? { ...get().currentConversation, title }
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
        .eq('conversation_id', conversation.id);

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

      const documentContext = formattedDocuments.join('\n\n---\n\n');
      
      // Ajouter une instruction claire au début du contexte
      const enhancedDocumentContext = `
CONTEXTE ISOLÉ - CONVERSATION ${conversation.id}
=====================================
Tu as accès UNIQUEMENT aux ${formattedDocuments.length} document(s) suivants pour cette conversation.
INTERDICTION de faire référence à tout autre document non listé ci-dessous.

${formattedDocuments.length > 1 ? `
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
        streamedContent = await generateChatResponseStreaming(
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
    } catch (error) {
      throw error;
    }
  },

  linkMultipleDocuments: async (documentIds: string[]) => {
    const conversation = get().currentConversation;
    if (!conversation) {
      set({ error: 'No conversation selected' });
      return { success: false, addedCount: 0, errors: [] };
    }

    // Limiter le nombre de documents pour éviter les problèmes de tokens
    const currentDocCount = get().documents.length;
    
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
        console.warn(`Limitation à ${availableSlots} document(s) pour respecter la limite de ${MAX_DOCUMENTS_PER_CONVERSATION} par conversation.`);
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
      
      // Créer un message récapitulatif si on a des documents (ajoutés ou déjà présents)
      const messages = get().messages;
      const isNewConversation = messages.length === 0 || (messages.length === 1 && messages[0].content === '');
      
      if (documentIds.length > 0 && isNewConversation) {
        // Pour une nouvelle conversation, créer un message récapitulatif avec TOUS les documents
        const allDocNames = get().documents
          .map(docWrapper => docWrapper.documents.name)
          .filter(Boolean);
        
        let messageContent = `Bonjour, je suis Ringo ! J'ai bien reçu `;
        
        if (allDocNames.length === 1) {
          messageContent += `le document "${allDocNames[0]}".`;
        } else {
          messageContent += `${allDocNames.length} documents :`;
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
            processed
          )
        `)
        .eq('conversation_id', conversationId);

      if (error) throw error;
      set({ documents: data || [] });
    } catch (error) {
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