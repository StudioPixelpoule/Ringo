import { create } from 'zustand';
import { supabase } from './supabase';
import { generateChatResponse, generateChatResponseStreaming } from './openai';
import { Document } from './documentStore';
import { handleStoreError, withErrorHandling } from './errorHandler';

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
  createConversationWithDocument: (document: Document) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  setCurrentConversation: (conversation: Conversation | null) => void;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  linkDocument: (documentId: string) => Promise<void>;
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

  fetchConversations: withErrorHandling(async () => {
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
      const errorMessage = await handleStoreError(error, 'ConversationStore', 'fetchConversations');
      set({ error: errorMessage });
    } finally {
      set({ loading: false });
    }
  }, { store: 'ConversationStore', action: 'fetchConversations' }),

  createConversation: withErrorHandling(async (title) => {
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
      const errorMessage = await handleStoreError(error, 'ConversationStore', 'createConversation');
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ loading: false });
    }
  }, { store: 'ConversationStore', action: 'createConversation' }),

  createConversationWithDocument: withErrorHandling(async (document) => {
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
      
      const { data: welcomeMessage, error: messageError } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversation.id,
          sender: 'assistant',
          content: `Je vois que vous avez ajouté le document "${document.name}". Je suis prêt à analyser son contenu. Que souhaitez-vous savoir ?`
        }])
        .select()
        .single();

      if (messageError) throw messageError;
      set({ messages: [welcomeMessage] });
    } catch (error) {
      const errorMessage = await handleStoreError(error, 'ConversationStore', 'createConversationWithDocument');
      set({ error: errorMessage });
    } finally {
      set({ loading: false });
    }
  }, { store: 'ConversationStore', action: 'createConversationWithDocument' }),

  deleteConversation: withErrorHandling(async (id) => {
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
      const errorMessage = await handleStoreError(error, 'ConversationStore', 'deleteConversation');
      set({ error: errorMessage });
    } finally {
      set({ loading: false });
    }
  }, { store: 'ConversationStore', action: 'deleteConversation' }),

  setCurrentConversation: (conversation) => {
    set({ currentConversation: conversation });
    if (conversation) {
      get().fetchMessages(conversation.id);
      get().fetchConversationDocuments(conversation.id);
    } else {
      set({ messages: [], documents: [] });
    }
  },

  updateConversationTitle: withErrorHandling(async (id, title) => {
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
      const errorMessage = await handleStoreError(error, 'ConversationStore', 'updateConversationTitle');
      set({ error: errorMessage });
    } finally {
      set({ loading: false });
    }
  }, { store: 'ConversationStore', action: 'updateConversationTitle' }),

  fetchMessages: withErrorHandling(async (conversationId) => {
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
      const errorMessage = await handleStoreError(error, 'ConversationStore', 'fetchMessages');
      set({ error: errorMessage });
    } finally {
      set({ loading: false });
    }
  }, { store: 'ConversationStore', action: 'fetchMessages' }),

  sendMessage: withErrorHandling(async (content) => {
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
            processed
          )
        `)
        .eq('conversation_id', conversation.id);

      if (!conversationDocs?.length) {
        throw new Error('Aucun document disponible pour analyse');
      }

      const formattedDocuments = await Promise.all(
        conversationDocs
          .map(doc => doc.documents)
          .filter(Boolean)
          .map(async doc => {
            const { data: contentData } = await supabase
              .from('document_contents')
              .select('content')
              .eq('document_id', doc.id)
              .single();

            return `
====== DÉBUT DU DOCUMENT: ${doc.name} (${doc.type}) ======

${contentData?.content || ''}

====== FIN DU DOCUMENT: ${doc.name} ======

INSTRUCTIONS: Le texte ci-dessus contient le contenu complet du document "${doc.name}". Utilise ce contenu pour répondre aux questions de l'utilisateur.
`;
          })
      );

      const documentContext = formattedDocuments.join('\n\n---\n\n');

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

      set({ messages: [...get().messages, aiMessage] });

      let streamedContent = '';
      await generateChatResponseStreaming(
        [...chatHistory, { role: 'user', content }],
        documentContext,
        async (chunk) => {
          streamedContent += chunk;
          
          const { error: updateError } = await supabase
            .from('messages')
            .update({ content: streamedContent })
            .eq('id', aiMessage.id);
            
          if (updateError) throw updateError;
          
          set({ 
            messages: get().messages.map(m => 
              m.id === aiMessage.id ? { ...m, content: streamedContent } : m
            )
          });
        }
      );

      get().markMessageAsStreamed(aiMessage.id);
    } catch (error) {
      const errorMessage = await handleStoreError(error, 'ConversationStore', 'sendMessage');
      set({ error: errorMessage });
    } finally {
      set({ loading: false, isTyping: false });
    }
  }, { store: 'ConversationStore', action: 'sendMessage' }),

  linkDocument: withErrorHandling(async (documentId) => {
    const conversation = get().currentConversation;
    if (!conversation) {
      set({ error: 'No conversation selected' });
      return;
    }

    set({ loading: true, error: null });
    try {
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
        const { data: acknowledgmentMessage, error: messageError } = await supabase
          .from('messages')
          .insert([{
            conversation_id: conversation.id,
            sender: 'assistant',
            content: `J'ai bien reçu le document "${doc.documents.name}". Je suis prêt à l'analyser avec les autres documents.`
          }])
          .select()
          .single();

        if (messageError) throw messageError;
        set({ messages: [...get().messages, acknowledgmentMessage] });
      }
    } catch (error) {
      const errorMessage = await handleStoreError(error, 'ConversationStore', 'linkDocument');
      set({ error: errorMessage });
    } finally {
      set({ loading: false });
    }
  }, { store: 'ConversationStore', action: 'linkDocument' }),

  unlinkDocument: withErrorHandling(async (documentId) => {
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
      
      await get().fetchConversationDocuments(conversation.id);
    } catch (error) {
      const errorMessage = await handleStoreError(error, 'ConversationStore', 'unlinkDocument');
      set({ error: errorMessage });
    } finally {
      set({ loading: false });
    }
  }, { store: 'ConversationStore', action: 'unlinkDocument' }),

  fetchConversationDocuments: withErrorHandling(async (conversationId) => {
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
      const errorMessage = await handleStoreError(error, 'ConversationStore', 'fetchConversationDocuments');
      set({ error: errorMessage });
    } finally {
      set({ loading: false });
    }
  }, { store: 'ConversationStore', action: 'fetchConversationDocuments' }),

  markMessageAsStreamed: (messageId) => {
    set(state => ({
      streamedMessages: new Set(state.streamedMessages).add(messageId)
    }));
  },

  clearError: () => set({ error: null }),
}));