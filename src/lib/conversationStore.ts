import { create } from 'zustand';
import { supabase } from './supabase';
import { generateChatResponse, ChatMessage } from './openai';
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

function parseDocumentContent(doc: Document): string {
  try {
    if (!doc.content) return '';
    
    const parsed = JSON.parse(doc.content);
    
    // Handle different document processing formats
    if (parsed.text) {
      return parsed.text;
    }
    
    if (parsed.metadata && parsed.structure) {
      // Handle PDF processing format
      const content = [
        parsed.metadata.title && `# ${parsed.metadata.title}`,
        parsed.structure.abstract && `## Abstract\n${parsed.structure.abstract}`,
        parsed.text && `## Content\n${parsed.text}`,
        parsed.structure.sections?.map(section => 
          `### ${section.heading || 'Section'}\n${section.content}`
        ).join('\n\n')
      ].filter(Boolean).join('\n\n');
      
      return content;
    }
    
    // Fallback to raw content
    return typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
  } catch (error) {
    console.warn('Failed to parse document content:', error);
    return doc.content;
  }
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
      set({ error: (error as Error).message });
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
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  createConversationWithDocument: async (document: Document) => {
    set({ loading: true, error: null });
    try {
      // Create new conversation with document name as title
      const conversation = await get().createConversation(document.name);
      
      // Link document to conversation
      const { error: linkError } = await supabase
        .from('conversation_documents')
        .insert([{
          conversation_id: conversation.id,
          document_id: document.id
        }]);

      if (linkError) throw linkError;
      
      // Set as current conversation and fetch documents
      set({ currentConversation: conversation });
      await get().fetchConversationDocuments(conversation.id);
      
      // Send initial message
      const initialMessage = `Je souhaite analyser le document "${document.name}". Pouvez-vous m'aider ?`;
      await get().sendMessage(initialMessage);
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  deleteConversation: async (id) => {
    set({ loading: true, error: null });
    try {
      // Delete conversation documents first
      const { error: docError } = await supabase
        .from('conversation_documents')
        .delete()
        .eq('conversation_id', id);

      if (docError) throw docError;

      // Delete messages
      const { error: msgError } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', id);

      if (msgError) throw msgError;

      // Finally delete the conversation
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
      set({ error: (error as Error).message });
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
      set({ error: (error as Error).message });
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
      set({ error: (error as Error).message });
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
      // Send user message
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

      // Update messages immediately with user message
      const messages = get().messages;
      set({ messages: [...messages, userMessage] });

      // Get conversation history for context
      const chatHistory: ChatMessage[] = get().messages.map(msg => ({
        role: msg.sender,
        content: msg.content
      }));

      // Get document content from all linked documents
      const documents = get().documents;
      const documentContents = documents
        .map(doc => parseDocumentContent(doc.documents))
        .filter(Boolean)
        .join('\n\n---\n\n');

      // Generate AI response with document content
      const aiResponse = await generateChatResponse(
        [...chatHistory, { role: 'user', content }],
        documentContents
      );

      // Save AI response
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

      // Update messages with AI response
      set({ messages: [...get().messages, aiMessage] });
    } catch (error) {
      set({ error: (error as Error).message });
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
      // Check if document is already linked
      const { data: existing } = await supabase
        .from('conversation_documents')
        .select('id')
        .eq('conversation_id', conversation.id)
        .eq('document_id', documentId)
        .single();

      if (existing) {
        set({ error: 'Document already linked to this conversation' });
        return;
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
      set({ error: (error as Error).message });
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
      set({ error: (error as Error).message });
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
            content,
            processed
          )
        `)
        .eq('conversation_id', conversationId);

      if (error) throw error;
      set({ documents: data || [] });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));