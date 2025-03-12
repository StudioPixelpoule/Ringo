import { create } from 'zustand';
import { supabase } from './supabase';
import { generateChatResponse } from './openai';
import { Document } from './documentStore';

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
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

async function formatDocument(doc: Document): Promise<string> {
  try {
    // Fetch document content from document_contents table
    const { data, error } = await supabase
      .from('document_contents')
      .select('content')
      .eq('document_id', doc.id)
      .single();

    if (error) {
      console.error('Error fetching document content:', error);
      return `⚠ Erreur lors de la récupération du contenu de "${doc.name}": ${error.message}`;
    }

    if (!data?.content) {
      console.warn('Document has no content:', doc.id);
      return `⚠ Document "${doc.name}" ne contient pas de contenu analysable.`;
    }

    return `📄 **DOCUMENT : ${doc.name}**\n📌 Type : ${doc.type}\n\n### Contenu\n${data.content}`;
  } catch (error) {
    console.error('Error formatting document:', {
      docId: doc.id,
      docName: doc.name,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return `⚠ Erreur lors du traitement de "${doc.name}": ${error instanceof Error ? error.message : 'Erreur inconnue'}`;
  }
}

interface ConversationStore {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  documents: ConversationDocument[];
  loading: boolean;
  error: string | null;
  isTyping: boolean;

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

  fetchConversations: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
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
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const { data, error } = await supabase
        .from('conversations')
        .insert([{ 
          title,
          user_id: userData.user.id
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

  createConversationWithDocument: async (document) => {
    set({ loading: true, error: null });
    try {
      // First check if document has content
      const { data: contentData, error: contentError } = await supabase
        .from('document_contents')
        .select('content')
        .eq('document_id', document.id)
        .single();

      if (contentError) throw contentError;
      if (!contentData?.content) {
        throw new Error('Document has no content to analyze');
      }

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
      set({ error: error instanceof Error ? error.message : 'Error creating conversation with document' });
    } finally {
      set({ loading: false });
    }
  },

  deleteConversation: async (id) => {
    set({ loading: true, error: null });
    try {
      const { error: docError } = await supabase
        .from('conversation_documents')
        .delete()
        .eq('conversation_id', id);

      if (docError) throw docError;

      const { error: msgError } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', id);

      if (msgError) throw msgError;

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

      const { data: conversationDocs, error: docError } = await supabase
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

      if (docError) throw docError;

      console.log('Formatting documents for analysis:', conversationDocs?.length || 0);

      const formattedDocuments = await Promise.all(
        (conversationDocs || [])
          .map(doc => doc.documents)
          .filter(Boolean)
          .map(async doc => {
            console.log('Processing document:', {
              id: doc.id,
              name: doc.name,
              type: doc.type,
              processed: doc.processed
            });
            return await formatDocument(doc);
          })
      );

      const combinedDocuments = formattedDocuments.join('\n\n---\n\n');

      if (!combinedDocuments.trim()) {
        throw new Error('No content available for analysis');
      }

      console.log('Sending to OpenAI:', {
        historyLength: chatHistory.length,
        documentsLength: combinedDocuments.length
      });

      const aiResponse = await generateChatResponse(
        [...chatHistory, { role: 'user', content }],
        combinedDocuments
      );

      const { data: aiMessage, error: aiError } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversation.id,
          sender: 'assistant',
          content: aiResponse
        }])
        .select()
        .single();

      if (aiError) throw aiError;

      set({ messages: [...get().messages, aiMessage] });
    } catch (error) {
      console.error('Error in sendMessage:', error);
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
      // First, fetch the document to verify it has content
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError) throw docError;
      if (!doc) throw new Error('Document not found');

      // Check if document content exists
      const { data: contentData, error: contentError } = await supabase
        .from('document_contents')
        .select('content')
        .eq('document_id', documentId)
        .single();

      if (contentError) throw contentError;
      if (!contentData?.content) throw new Error('Document has no content');

      console.log('Linking document:', {
        id: doc.id,
        name: doc.name,
        hasContent: !!contentData.content,
        contentLength: contentData.content?.length || 0
      });

      // Check if document is already linked
      const { data: existing, error: checkError } = await supabase
        .from('conversation_documents')
        .select('*')
        .eq('conversation_id', conversation.id)
        .eq('document_id', documentId);

      if (checkError) throw checkError;

      if (existing && existing.length > 0) {
        set({ error: 'Document already linked to this conversation' });
        return;
      }

      // Link the document
      const { error } = await supabase
        .from('conversation_documents')
        .insert([{
          conversation_id: conversation.id,
          document_id: documentId
        }]);

      if (error) throw error;
      
      await get().fetchConversationDocuments(conversation.id);

      const currentMessages = get().messages;
      if (currentMessages.length === 0) {
        const { data: welcomeMessage, error: messageError } = await supabase
          .from('messages')
          .insert([{
            conversation_id: conversation.id,
            sender: 'assistant',
            content: `Je vois que vous avez ajouté le document "${doc.name}". Je suis prêt à analyser son contenu. Que souhaitez-vous savoir ?`
          }])
          .select()
          .single();

        if (messageError) throw messageError;
        set({ messages: [welcomeMessage] });
      } else {
        const { data: acknowledgmentMessage, error: messageError } = await supabase
          .from('messages')
          .insert([{
            conversation_id: conversation.id,
            sender: 'assistant',
            content: `J'ai bien reçu le document "${doc.name}". Je suis prêt à l'analyser avec les autres documents quand vous le souhaiterez.`
          }])
          .select()
          .single();

        if (messageError) throw messageError;
        set({ messages: [...currentMessages, acknowledgmentMessage] });
      }
    } catch (error) {
      console.error('Error linking document:', error);
      set({ error: error instanceof Error ? error.message : 'Error linking document' });
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
      
      await get().fetchConversationDocuments(conversation.id);
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
      
      console.log('Fetched conversation documents:', {
        count: data?.length || 0,
        hasContent: data?.every(d => d.documents?.processed)
      });
      
      set({ documents: data || [] });
    } catch (error) {
      console.error('Error fetching conversation documents:', error);
      set({ error: error instanceof Error ? error.message : 'Error fetching conversation documents' });
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));