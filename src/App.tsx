import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import { supabase } from './lib/supabase';
import { createChatCompletion, generateContextFromDocuments, summarizeDocument } from './lib/openai';
import { extractDocumentContent, getDocumentContent } from './lib/documentProcessor';
import type { User } from '@supabase/supabase-js';
import type { Document, Profile, Message, Conversation } from './lib/types';
import { RingoLogo } from './components/RingoLogo';
import { LogoutIcon } from './components/LogoutIcon';
import { DocumentStackIcon } from './components/DocumentStackIcon';
import { MindMapModal } from './components/MindMapModal';
import { ImportWindow } from './components/ImportWindow';
import { ChatInput } from './components/ChatInput';
import { Conversation as ConversationComponent } from './components/Conversation';
import { ConversationList } from './components/ConversationList';
import { OpenAIKeyModal } from './components/OpenAIKeyModal';
import { DocumentsPanel } from './components/DocumentsPanel';
import { AdminControls } from './components/AdminControls';
import { AudioTranscriptionModal } from './components/AudioTranscriptionModal';
import { v4 as uuidv4 } from 'uuid';
import { ErrorBoundary } from './lib/errorBoundary';
import { logger } from './lib/logger';

interface FolderStructure {
  [key: string]: {
    files: Document[];
    subfolders: FolderStructure;
  };
}

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isMindMapOpen, setIsMindMapOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folderStructure, setFolderStructure] = useState<FolderStructure>({});
  
  // Chat state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentSharedDocument, setCurrentSharedDocument] = useState<Document | null>(null);
  const [documentContent, setDocumentContent] = useState<string>("");
  const [documentProcessingStatus, setDocumentProcessingStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
  const [manualDocumentInput, setManualDocumentInput] = useState<boolean>(false);
  const [sharedDocuments, setSharedDocuments] = useState<Array<{document: Document, content: string}>>([]);
  const [isAudioTranscriptionModalOpen, setIsAudioTranscriptionModalOpen] = useState(false);
  
  // OpenAI configuration
  const [isOpenAIKeyModalOpen, setIsOpenAIKeyModalOpen] = useState(false);
  const [openAIConfigured, setOpenAIConfigured] = useState(false);

  useEffect(() => {
    // Vérifier si une clé API OpenAI est configurée
    const storedKey = localStorage.getItem('openai-api-key');
    const envKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    const isConfigured = !!(storedKey || (envKey && envKey !== 'dummy-key' && envKey !== 'your-openai-api-key-here'));
    setOpenAIConfigured(isConfigured);
    
    // Si aucune clé n'est configurée, afficher le modal de configuration
    if (!isConfigured) {
      setIsOpenAIKeyModalOpen(true);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      
      // Log l'événement de connexion
      if (session?.user) {
        logger.info('Utilisateur connecté', { userId: session.user.id, email: session.user.email }, 'Auth');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      
      // Log les événements d'authentification
      if (_event === 'SIGNED_IN' && session?.user) {
        logger.info('Utilisateur connecté', { userId: session.user.id, email: session.user.email }, 'Auth');
      } else if (_event === 'SIGNED_OUT') {
        logger.info('Utilisateur déconnecté', null, 'Auth');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadDocuments();
      loadUserProfile();
      loadConversations();
    }
  }, [user]);

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId]);

  // Effet pour extraire le contenu du document lorsqu'il est partagé
  useEffect(() => {
    if (currentSharedDocument) {
      const extractContent = async () => {
        setDocumentProcessingStatus('processing');
        try {
          // Vérifier d'abord si le contenu existe déjà dans la base de données
          const existingContent = await getDocumentContent(currentSharedDocument.id);
          
          if (existingContent) {
            console.log('Contenu du document trouvé dans la base de données');
            logger.info('Contenu du document récupéré depuis la base de données', 
              { documentId: currentSharedDocument.id, documentName: currentSharedDocument.name }, 
              'DocumentProcessor');
            
            setDocumentContent(existingContent);
            setDocumentProcessingStatus('completed');
            
            // Ajouter le document à la liste des documents partagés
            setSharedDocuments(prev => {
              // Vérifier si le document existe déjà
              if (prev.some(doc => doc.document.id === currentSharedDocument.id)) {
                return prev;
              }
              return [...prev, {document: currentSharedDocument, content: existingContent}];
            });
            
            return;
          }
          
          // Vérifier si c'est un fichier audio
          const fileExtension = currentSharedDocument.name.split('.').pop()?.toLowerCase();
          const isAudioFile = ['mp3', 'wav', 'ogg', 'm4a'].includes(fileExtension || '');
          
          if (isAudioFile) {
            // Pour les fichiers audio, ouvrir le modal de transcription
            setIsAudioTranscriptionModalOpen(true);
            setDocumentContent("Ce document est un fichier audio. Une transcription est nécessaire.");
            setDocumentProcessingStatus('processing');
            
            logger.info('Modal de transcription audio ouvert', 
              { documentId: currentSharedDocument.id, documentName: currentSharedDocument.name }, 
              'AudioTranscription');
            
            return;
          }
          
          const content = await extractDocumentContent(currentSharedDocument);
          
          // Vérifier si le contenu indique un échec d'extraction
          if (content.includes("Impossible d'extraire") || 
              content.includes("Ce format nécessite une conversion") ||
              content.includes("n'est pas pris en charge")) {
            console.log('Échec de l\'extraction automatique, demande de saisie manuelle');
            logger.warning('Échec de l\'extraction automatique du document', 
              { documentId: currentSharedDocument.id, documentName: currentSharedDocument.name, error: content }, 
              'DocumentProcessor');
            
            setDocumentContent("");
            setDocumentProcessingStatus('error');
            setManualDocumentInput(true);
          } else {
            logger.info('Document extrait avec succès', 
              { documentId: currentSharedDocument.id, documentName: currentSharedDocument.name, contentLength: content.length }, 
              'DocumentProcessor');
            
            setDocumentContent(content);
            setDocumentProcessingStatus('completed');
            
            // Ajouter le document à la liste des documents partagés
            setSharedDocuments(prev => {
              // Vérifier si le document existe déjà
              if (prev.some(doc => doc.document.id === currentSharedDocument.id)) {
                return prev;
              }
              return [...prev, {document: currentSharedDocument, content}];
            });
          }
        } catch (error) {
          console.error("Erreur lors de l'extraction du contenu:", error);
          logger.error("Erreur lors de l'extraction du contenu du document", 
            { documentId: currentSharedDocument.id, documentName: currentSharedDocument.name, error }, 
            'DocumentProcessor');
          
          setDocumentProcessingStatus('error');
          setDocumentContent("Une erreur s'est produite lors de l'extraction du contenu du document.");
          setManualDocumentInput(true);
        }
      };
      
      extractContent();
    } else {
      setDocumentContent("");
      setDocumentProcessingStatus('idle');
      setManualDocumentInput(false);
    }
  }, [currentSharedDocument]);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert([{ id: user.id, role: 'user' }])
          .select()
          .single();

        if (insertError) throw insertError;
        setProfile(newProfile);
        
        logger.info('Nouveau profil utilisateur créé', { userId: user.id, role: 'user' }, 'UserProfile');
      } else {
        setProfile(data);
        logger.info('Profil utilisateur chargé', { userId: user.id, role: data.role }, 'UserProfile');
      }
    } catch (err) {
      console.error('Erreur lors du chargement du profil:', err);
      logger.error('Erreur lors du chargement du profil utilisateur', { userId: user.id, error: err }, 'UserProfile');
    }
  };

  const buildFolderStructure = useCallback((docs: Document[]): FolderStructure => {
    const structure: FolderStructure = {
      '': { files: [], subfolders: {} }
    };

    docs.forEach(doc => {
      if (!doc.folder) {
        structure[''].files.push(doc);
        return;
      }

      const parts = doc.folder.split('/');
      let current = structure;
      let path = '';

      parts.forEach((part, index) => {
        path = path ? `${path}/${part}` : part;
        
        if (!current[part]) {
          current[part] = {
            files: [],
            subfolders: {}
          };
        }

        if (index === parts.length - 1) {
          current[part].files.push(doc);
        }

        current = current[part].subfolders;
      });
    });

    return structure;
  }, []);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const structure = buildFolderStructure(data || []);
      setFolderStructure(structure);
      setDocuments(data || []);
      
      logger.info('Documents chargés', { count: data?.length || 0 }, 'Documents');
    } catch (err) {
      console.error('Erreur lors du chargement des documents:', err);
      logger.error('Erreur lors du chargement des documents', { error: err }, 'Documents');
    }
  };

  const loadConversations = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setConversations(data || []);
      
      // Si aucune conversation active et qu'il y a des conversations, sélectionner la première
      if (!activeConversationId && data && data.length > 0) {
        setActiveConversationId(data[0].id);
      }
      
      logger.info('Conversations chargées', { count: data?.length || 0, userId: user.id }, 'Conversations');
    } catch (err) {
      console.error('Erreur lors du chargement des conversations:', err);
      logger.error('Erreur lors du chargement des conversations', { userId: user.id, error: err }, 'Conversations');
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data || []);
      logger.info('Messages chargés', { conversationId, count: data?.length || 0 }, 'Messages');
    } catch (err) {
      console.error('Erreur lors du chargement des messages:', err);
      logger.error('Erreur lors du chargement des messages', { conversationId, error: err }, 'Messages');
    }
  };

  const createNewConversation = async () => {
    if (!user) return;

    try {
      const newConversation: Partial<Conversation> = {
        id: uuidv4(),
        title: 'Nouvelle conversation',
        user_id: user.id,
      };

      const { error } = await supabase
        .from('conversations')
        .insert([newConversation]);

      if (error) throw error;

      // Recharger les conversations et sélectionner la nouvelle
      await loadConversations();
      setActiveConversationId(newConversation.id as string);
      
      logger.info('Nouvelle conversation créée', { conversationId: newConversation.id, userId: user.id }, 'Conversations');
    } catch (err) {
      console.error('Erreur lors de la création d\'une conversation:', err);
      logger.error('Erreur lors de la création d\'une conversation', { userId: user.id, error: err }, 'Conversations');
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      // Supprimer les messages de la conversation
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);

      if (messagesError) throw messagesError;

      // Supprimer la conversation
      const { error: conversationError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (conversationError) throw conversationError;

      // Mettre à jour l'état local
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      // Si la conversation supprimée était active, sélectionner une autre
      if (activeConversationId === conversationId) {
        const remainingConversations = conversations.filter(conv => conv.id !== conversationId);
        setActiveConversationId(remainingConversations.length > 0 ? remainingConversations[0].id : null);
      }
      
      logger.info('Conversation supprimée', { conversationId }, 'Conversations');
    } catch (err) {
      console.error('Erreur lors de la suppression de la conversation:', err);
      logger.error('Erreur lors de la suppression de la conversation', { conversationId, error: err }, 'Conversations');
    }
  };

  const updateConversationTitle = async (conversationId: string, title: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ title })
        .eq('id', conversationId);

      if (error) throw error;

      // Mettre à jour l'état local
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId ? { ...conv, title } : conv
        )
      );
      
      logger.info('Titre de conversation mis à jour', { conversationId, title }, 'Conversations');
    } catch (err) {
      console.error('Erreur lors de la mise à jour du titre:', err);
      logger.error('Erreur lors de la mise à jour du titre de conversation', { conversationId, title, error: err }, 'Conversations');
    }
  };

  const handleSendDocumentToConversation = (document: Document) => {
    if (!activeConversationId) {
      createNewConversation().then(() => {
        // La fonction sera rappelée après la création de la conversation
        setCurrentSharedDocument(document);
      });
      return;
    }

    setCurrentSharedDocument(document);
    
    // Créer un message utilisateur pour indiquer le partage du document
    // Simplifier l'affichage pour montrer uniquement le nom du fichier
    const message = `**Document partagé:** ${document.name}`;
    handleSendMessage(message);
    
    logger.info('Document partagé dans la conversation', 
      { documentId: document.id, documentName: document.name, conversationId: activeConversationId }, 
      'Conversation');
  };

  const removeSharedDocument = (document: Document) => {
    setSharedDocuments(prev => prev.filter(doc => doc.document.id !== document.id));
    if (currentSharedDocument?.id === document.id) {
      setCurrentSharedDocument(null);
    }
    
    logger.info('Document retiré de la conversation', 
      { documentId: document.id, documentName: document.name }, 
      'Conversation');
  };

  const handleManualDocumentContent = (content: string) => {
    if (!content.trim()) return;
    
    setDocumentContent(content);
    setDocumentProcessingStatus('completed');
    setManualDocumentInput(false);
    
    // Si nous avons un document partagé, stocker le contenu dans la base de données
    if (currentSharedDocument) {
      // Stocker le contenu manuellement saisi
      storeManualDocumentContent(currentSharedDocument.id, content);
      
      // Ajouter le document à la liste des documents partagés
      setSharedDocuments(prev => {
        // Vérifier si le document existe déjà
        if (prev.some(doc => doc.document.id === currentSharedDocument.id)) {
          return prev.map(doc => 
            doc.document.id === currentSharedDocument.id 
              ? {...doc, content} 
              : doc
          );
        }
        return [...prev, {document: currentSharedDocument, content}];
      });
      
      logger.info('Contenu de document saisi manuellement', 
        { documentId: currentSharedDocument.id, documentName: currentSharedDocument.name, contentLength: content.length }, 
        'DocumentProcessor');
    }
  };

  const handleAudioTranscriptionComplete = (transcription: string) => {
    if (currentSharedDocument) {
      setDocumentContent(transcription);
      setDocumentProcessingStatus('completed');
      setIsAudioTranscriptionModalOpen(false);
      
      // Ajouter le document à la liste des documents partagés
      setSharedDocuments(prev => {
        // Vérifier si le document existe déjà
        if (prev.some(doc => doc.document.id === currentSharedDocument.id)) {
          return prev.map(doc => 
            doc.document.id === currentSharedDocument.id 
              ? {...doc, content: transcription} 
              : doc
          );
        }
        return [...prev, {document: currentSharedDocument, content: transcription}];
      });
      
      logger.info('Transcription audio complétée', 
        { documentId: currentSharedDocument.id, documentName: currentSharedDocument.name, transcriptionLength: transcription.length }, 
        'AudioTranscription');
    }
  };

  const storeManualDocumentContent = async (documentId: string, content: string) => {
    try {
      // Vérifier si un enregistrement existe déjà
      const { data: existingContent, error: checkError } = await supabase
        .from('document_contents')
        .select('id')
        .eq('document_id', documentId)
        .maybeSingle();
      
      if (checkError) {
        console.error('[DOCUMENT_RETRIEVAL] Erreur lors de la vérification du contenu existant:', checkError);
        logger.error('Erreur lors de la vérification du contenu existant', 
          { documentId, error: checkError }, 
          'DocumentProcessor');
        return;
      }
      
      if (existingContent) {
        // Mettre à jour l'enregistrement existant
        const { error: updateError } = await supabase
          .from('document_contents')
          .update({
            content: content,
            extraction_status: 'manual',
            updated_at: new Date().toISOString()
          })
          .eq('document_id', documentId);
        
        if (updateError) {
          console.error('[DOCUMENT_RETRIEVAL] Erreur lors de la mise à jour du contenu manuel:', updateError);
          logger.error('Erreur lors de la mise à jour du contenu manuel', 
            { documentId, error: updateError }, 
            'DocumentProcessor');
        } else {
          logger.info('Contenu de document mis à jour manuellement', 
            { documentId, contentLength: content.length }, 
            'DocumentProcessor');
        }
      } else {
        // Créer un nouvel enregistrement
        const { error: insertError } = await supabase
          .from('document_contents')
          .insert({
            document_id: documentId,
            content: content,
            extraction_status: 'manual'
          });
        
        if (insertError) {
          console.error('[DOCUMENT_RETRIEVAL] Erreur lors du stockage du contenu manuel:', insertError);
          logger.error('Erreur lors du stockage du contenu manuel', 
            { documentId, error: insertError }, 
            'DocumentProcessor');
        } else {
          logger.info('Nouveau contenu de document stocké manuellement', 
            { documentId, contentLength: content.length }, 
            'DocumentProcessor');
        }
      }
    } catch (error) {
      console.error('[DOCUMENT_RETRIEVAL] Erreur lors du stockage du contenu manuel:', error);
      logger.error('Erreur lors du stockage du contenu manuel', 
        { documentId, error }, 
        'DocumentProcessor');
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!user || !content.trim() || isProcessing) return;

    // Créer une nouvelle conversation si nécessaire
    if (!activeConversationId) {
      await createNewConversation();
      return; // La fonction sera rappelée après la création de la conversation
    }

    setIsProcessing(true);

    try {
      // Ajouter le message de l'utilisateur
      const userMessage: Message = {
        id: uuidv4(),
        role: 'user',
        content,
        created_at: new Date().toISOString(),
        conversation_id: activeConversationId
      };

      // Mettre à jour l'interface utilisateur immédiatement
      setMessages(prev => [...prev, userMessage]);

      // Enregistrer le message dans la base de données
      const { error: userMessageError } = await supabase
        .from('messages')
        .insert([userMessage]);

      if (userMessageError) throw userMessageError;

      // Mettre à jour le titre de la conversation s'il s'agit du premier message
      if (messages.length === 0) {
        // Utiliser les premiers mots du message comme titre
        const title = content.length > 30 
          ? content.substring(0, 30) + '...' 
          : content;
        
        await updateConversationTitle(activeConversationId, title);
      }

      // Vérifier si le message concerne un document partagé
      let isDocumentMessage = content.includes("**Document partagé:**");
      
      // Rechercher des documents pertinents
      const relevantDocs = await findRelevantDocuments(content);
      
      // Générer une réponse avec l'API OpenAI
      const context = await generateContextFromDocuments(relevantDocs, content);
      
      let systemPrompt = `
Tu es Ringo, un assistant IA spécialisé pour l'IRSST (Institut de recherche Robert-Sauvé en santé et en sécurité du travail).
Tu dois aider les utilisateurs à trouver des informations sur la santé et la sécurité au travail.

Voici quelques informations contextuelles basées sur les documents disponibles:
${context}
`;

      // Ajouter le contenu du document si disponible
      if (isDocumentMessage && documentContent) {
        systemPrompt += `
L'utilisateur a partagé un document. Voici son contenu:
${documentContent}

Utilise ces informations pour répondre à la question de l'utilisateur.
`;
      }

      systemPrompt += `
Réponds de manière concise, précise et professionnelle. Si tu ne connais pas la réponse, dis-le clairement.
`;

      const chatHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Ajouter le message de l'utilisateur à l'historique
      chatHistory.push({
        role: 'user',
        content
      });

      // Ajouter le prompt système
      const fullMessages = [
        { role: 'system', content: systemPrompt },
        ...chatHistory
      ] as Message[];

      // Vérifier si l'utilisateur demande un résumé du document
      const isAskingForSummary = 
        content.toLowerCase().includes("résume") || 
        content.toLowerCase().includes("resume") || 
        content.toLowerCase().includes("résumé") || 
        content.toLowerCase().includes("synthèse") ||
        content.toLowerCase().includes("synthese") ||
        (content.toLowerCase().includes("résumer") && isDocumentMessage);

      let response;
      
      if (isAskingForSummary && documentContent && currentSharedDocument) {
        // Générer un résumé du document
        logger.info('Génération d\'un résumé de document', 
          { documentId: currentSharedDocument.id, documentName: currentSharedDocument.name }, 
          'OpenAI');
        
        const summary = await summarizeDocument(documentContent, currentSharedDocument.name);
        response = { content: summary };
      } else {
        // Réponse normale via l'API OpenAI
        logger.info('Envoi de requête à l\'API OpenAI', 
          { messageCount: fullMessages.length, conversationId: activeConversationId }, 
          'OpenAI');
        
        response = await createChatCompletion({
          messages: fullMessages,
          temperature: 0.7
        });
      }

      // Créer le message de réponse
      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: response.content || "Je suis désolé, je n'ai pas pu générer de réponse.",
        created_at: new Date().toISOString(),
        conversation_id: activeConversationId
      };

      // Mettre à jour l'interface utilisateur
      setMessages(prev => [...prev, assistantMessage]);

      // Enregistrer la réponse dans la base de données
      const { error: assistantMessageError } = await supabase
        .from('messages')
        .insert([assistantMessage]);

      if (assistantMessageError) throw assistantMessageError;
      
      logger.info('Message assistant ajouté', 
        { conversationId: activeConversationId, messageLength: assistantMessage.content.length }, 
        'Conversation');

    } catch (err) {
      console.error('Erreur lors de l\'envoi du message:', err);
      logger.error('Erreur lors de l\'envoi du message', 
        { conversationId: activeConversationId, error: err }, 
        'Conversation');
      
      // Ajouter un message d'erreur
      const errorMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: "Je suis désolé, une erreur s'est produite lors du traitement de votre demande. Veuillez réessayer.",
        created_at: new Date().toISOString(),
        conversation_id: activeConversationId
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
    } finally {
      setIsProcessing(false);
    }
  };

  const findRelevantDocuments = async (query: string): Promise<Document[]> => {
    // Cette fonction pourrait être améliorée avec une recherche vectorielle
    // Pour l'instant, on fait une recherche simple par mots-clés
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    if (keywords.length === 0) return [];
    
    // Filtrer les documents qui contiennent au moins un des mots-clés dans leur nom
    return documents.filter(doc => {
      const docName = doc.name.toLowerCase();
      return keywords.some(keyword => docName.includes(keyword));
    }).slice(0, 5); // Limiter à 5 documents
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      
      logger.info('Tentative de connexion réussie', { email }, 'Auth');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
      logger.error('Échec de connexion', { email, error: err }, 'Auth');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      logger.info('Déconnexion réussie', { userId: user?.id }, 'Auth');
    } catch (err) {
      console.error('Erreur lors de la déconnexion:', err);
      logger.error('Erreur lors de la déconnexion', { userId: user?.id, error: err }, 'Auth');
    }
  };

  const handleSaveOpenAIKey = async (apiKey: string) => {
    try {
      console.log('Sauvegarde de la clé API OpenAI');
      
      // Stocker la clé dans localStorage
      localStorage.setItem('openai-api-key', apiKey);
      
      // Mettre à jour l'état
      setOpenAIConfigured(true);
      
      logger.info('Clé API OpenAI configurée', null, 'Config');
      
      return true;
    } catch (error) {
      console.error('[OPENAI] Erreur lors de la sauvegarde de la clé API:', error);
      logger.error('Erreur lors de la sauvegarde de la clé API OpenAI', { error }, 'Config');
      return false;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f15922] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-16">
            <RingoLogo className="text-white mx-auto mb-6" size={120} />
            <h1 className="text-5xl font-bold text-white relative">
              RINGO
              <span className="text-white text-xs absolute top-0 ml-1" style={{ fontSize: '0.3em', verticalAlign: 'super' }}>By AI</span>
            </h1>
          </div>

          <form onSubmit={handleLogin} className="bg-white bg-opacity-10 backdrop-blur-lg rounded-2xl shadow-xl p-8 space-y-6">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-white">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white bg-opacity-20 text-white placeholder-white placeholder-opacity-70 outline-none border border-white border-opacity-30 focus:border-opacity-70 transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-white">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white bg-opacity-20 text-white placeholder-white placeholder-opacity-70 outline-none border border-white border-opacity-30 focus:border-opacity-70 transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-neumorphic bg-[#2f5c54] text-white py-3 px-4 rounded-lg font-bold text-lg disabled:opacity-50 transition-all"
            >
              {loading ? 'Connexion...' : 'Allons-y !'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary userId={user.id}>
      <div className="flex h-screen">
        {/* Left Sidebar */}
        <div className="flex flex-col w-[300px]">
          {/* Conversations Section */}
          <ConversationList 
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={setActiveConversationId}
            onCreateConversation={createNewConversation}
            onDeleteConversation={deleteConversation}
            onUpdateConversationTitle={updateConversationTitle}
          />
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-[#f15922] p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <RingoLogo className="text-white" size={64} />
              <div className="flex items-start">
                <h1 className="text-2xl font-bold text-white">RINGO</h1>
                <span className="text-white text-xs ml-1" style={{ verticalAlign: 'super' }}>by AI</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {profile?.role === 'admin' && (
                <button 
                  onClick={() => setIsImportOpen(true)}
                  className="btn-neumorphic bg-[#f15922] text-white p-3 rounded-full hover:text-white focus:outline-none"
                  title="Importer un document"
                >
                  <DocumentStackIcon className="text-white" size={24} />
                </button>
              )}
              <span className="text-white">{user.email}</span>
              <button
                onClick={handleLogout} 
                className="btn-neumorphic bg-[#f15922] text-white p-3 rounded-full hover:text-white focus:outline-none"
                title="Déconnexion"
              >
                <LogoutIcon className="text-white" size={24} />
              </button>
            </div>
          </div>

          {/* Chat Content */}
          <ConversationComponent 
            messages={messages}
            isLoading={isProcessing || documentProcessingStatus === 'processing'}
          />

          {/* Documents Panel */}
          {sharedDocuments.length > 0 && (
            <DocumentsPanel
              documents={sharedDocuments}
              currentDocument={currentSharedDocument}
              onSelectDocument={setCurrentSharedDocument}
              onRemoveDocument={removeSharedDocument}
            />
          )}

          {/* Manual Document Input */}
          {manualDocumentInput && (
            <div className="bg-[#f8f7f2] p-4 border-t border-gray-200">
              <div className="max-w-4xl mx-auto">
                <h3 className="text-lg font-medium text-[#2F4F4F] mb-2">
                  Saisie manuelle du contenu du document
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  L'extraction automatique du contenu a échoué. Veuillez copier-coller le contenu du document ci-dessous.
                </p>
                <textarea
                  className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                  placeholder="Collez ici le contenu du document..."
                  onChange={(e) => setDocumentContent(e.target.value)}
                  value={documentContent}
                ></textarea>
                <div className="flex justify-end mt-2 space-x-2">
                  <button
                    onClick={() => setManualDocumentInput(false)}
                    className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => handleManualDocumentContent(documentContent)}
                    className="px-4 py-2 text-white bg-[#f15922] rounded-lg hover:bg-[#d14811] transition-colors"
                    disabled={!documentContent.trim()}
                  >
                    Envoyer
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Chat Input */}
          <ChatInput 
            onSendMessage={handleSendMessage}
            onOpenMindMap={() => setIsMindMapOpen(true)}
            isLoading={isProcessing || documentProcessingStatus === 'processing'}
          />
        </div>

        {/* Right Sidebar */}
        <div className="w-[300px] bg-[#dba747]">
          <div className="p-4">
            <h2 className="text-white text-lg font-medium mb-4">Rapports</h2>
            <div className="bg-white rounded-lg p-4">
              <h3 className="text-[#2F4F4F] font-medium mb-2">Modèles</h3>
              <p className="text-[#2F4F4F] text-center mt-4">Aucun modèle disponible</p>
            </div>
          </div>
        </div>

        {/* MindMap Modal */}
        <MindMapModal
          isOpen={isMindMapOpen}
          onClose={() => setIsMindMapOpen(false)}
          documents={documents}
          onSendToConversation={handleSendDocumentToConversation}
        />

        {/* Import Window */}
        {profile?.role === 'admin' && (
          <ImportWindow
            isOpen={isImportOpen}
            onClose={() => setIsImportOpen(false)}
            userId={user.id}
            onDocumentAdded={loadDocuments}
            folderStructure={folderStructure}
          />
        )}

        {/* OpenAI Key Modal */}
        <OpenAIKeyModal
          isOpen={isOpenAIKeyModalOpen}
          onClose={() => setIsOpenAIKeyModalOpen(false)}
          onSave={handleSaveOpenAIKey}
        />

        {/* Audio Transcription Modal */}
        {isAudioTranscriptionModalOpen && currentSharedDocument && (
          <AudioTranscriptionModal
            isOpen={isAudioTranscriptionModalOpen}
            onClose={() => setIsAudioTranscriptionModalOpen(false)}
            document={currentSharedDocument}
            onTranscriptionComplete={handleAudioTranscriptionComplete}
          />
        )}

        {/* Admin Controls */}
        {profile?.role === 'admin' && (
          <AdminControls userId={user.id} />
        )}

        {/* OpenAI Configuration Banner */}
        {!openAIConfigured && (
          <div className="fixed bottom-0 left-0 right-0 bg-yellow-100 p-4 border-t border-yellow-200 flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="text-yellow-600 mr-3" size={24} />
              <div>
                <p className="font-medium text-yellow-800">Clé API OpenAI non configurée</p>
                <p className="text-yellow-700 text-sm">Les fonctionnalités d'IA ne sont pas disponibles. Configurez votre clé API pour activer toutes les fonctionnalités.</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpenAIKeyModalOpen(true)} 
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              Configurer
            </button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;