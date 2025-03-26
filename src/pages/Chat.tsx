import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Users, ArrowRight, LogOut, Database, FileText, Globe, AlertTriangle, UserPlus, Settings, FileSpreadsheet } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { SmallLogo } from '../components/SmallLogo';
import { IrsstLogo } from '../components/IrsstLogo';
import { DocumentIcon } from '../components/DocumentIcon';
import { DocumentListIcon } from '../components/DocumentListIcon';
import { UserManagementModal } from '../components/UserManagementModal';
import { DocumentImportModal } from '../components/DocumentImportModal';
import { FileManagementModal } from '../components/FileManagementModal';
import { FileExplorer } from '../components/FileExplorer';
import { ConversationList } from '../components/ConversationList';
import { DocumentList } from '../components/DocumentList';
import { MessageItem } from '../components/MessageItem';
import { ReportTemplateManager } from '../components/ReportTemplateManager';
import { ReportGeneratorWidget } from '../components/ReportGeneratorWidget';
import { FeedbackButton } from '../components/FeedbackButton';
import { FeedbackManager } from '../components/FeedbackManager';
import { WebContentImporter } from '../components/WebContentImporter';
import { ErrorLogViewer } from '../components/ErrorLogViewer';
import { CreateUserModal } from '../components/CreateUserModal';
import { AddUserModal } from '../components/AddUserModal';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../lib/store';
import { useDocumentStore } from '../lib/documentStore';
import { useConversationStore } from '../lib/conversationStore';
import { AppError } from '../lib/AppError';
import { handleError } from '../lib/errorHandler';
import { AuthErrorType } from '../lib/errorTypes';
import './Chat.css';

interface ChatProps {
  session: Session;
}

export function Chat({ session }: ChatProps) {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [isFileExplorerOpen, setFileExplorerOpen] = useState(false);
  const [isFileManagementOpen, setFileManagementOpen] = useState(false);
  const [isTemplateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [isWebsiteImportOpen, setWebsiteImportOpen] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [isErrorLogOpen, setErrorLogOpen] = useState(false);
  const [isCreateUserOpen, setCreateUserOpen] = useState(false);
  const [isAddUserOpen, setAddUserOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const { setModalOpen: setUserModalOpen } = useUserStore();
  const { setModalOpen: setDocumentModalOpen } = useDocumentStore();
  const userRole = useUserStore(state => state.userRole);

  const {
    messages,
    currentConversation,
    documents: conversationDocuments,
    isTyping,
    sendMessage,
    fetchConversations,
    unlinkDocument,
  } = useConversationStore();

  const lastAssistantMessageIndex = messages
    .map((m, i) => ({ ...m, index: i }))
    .filter(m => m.sender === 'assistant')
    .pop()?.index;

  // Error handling effect
  useEffect(() => {
    const errorHandler = async (event: ErrorEvent) => {
      try {
        await handleError(event.error, {
          component: 'Chat',
          action: 'globalErrorHandler',
          location: window.location.href,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        // If error handling itself fails, log to console as last resort
        console.error('Critical error in error handler:', error);
      }
    };

    const rejectionHandler = async (event: PromiseRejectionEvent) => {
      try {
        const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
        await handleError(error, {
          component: 'Chat',
          action: 'unhandledRejection',
          location: window.location.href,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Critical error in rejection handler:', error);
      }
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);

    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
    };
  }, []);

  // Fetch conversations effect
  useEffect(() => {
    fetchConversations().catch(async (error) => {
      await handleError(error, {
        component: 'Chat',
        action: 'fetchConversations',
        conversationId: currentConversation?.id
      });
    });
  }, [fetchConversations, currentConversation?.id]);

  // Scroll handling effect
  useEffect(() => {
    const handleScroll = () => {
      if (!messagesContainerRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isScrolledToBottom = scrollHeight - scrollTop <= clientHeight + 50;
      
      if (!isScrolledToBottom) {
        setUserHasScrolled(true);
      } else {
        setUserHasScrolled(false);
      }
    };

    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  // Auto-scroll effect
  useEffect(() => {
    if (userHasScrolled) return;

    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    scrollToBottom();

    const handleResize = () => {
      if (!userHasScrolled) {
        scrollToBottom();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [messages, userHasScrolled]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping || !currentConversation) return;
    
    const content = input.trim();
    setInput('');
    setUserHasScrolled(false);

    try {
      await sendMessage(content);
      
      inputRef.current?.focus();
      
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      await handleError(error, {
        component: 'Chat',
        action: 'sendMessage',
        conversationId: currentConversation.id,
        messageContent: content
      });
    }
  }, [input, isTyping, currentConversation, sendMessage]);

  const adjustTextareaHeight = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      navigate('/login');
    } catch (error) {
      // For auth errors, we want to force logout anyway
      if (error instanceof AppError && error.type === AuthErrorType.SESSION_EXPIRED) {
        navigate('/login');
        return;
      }

      await handleError(error, {
        component: 'Chat',
        action: 'handleLogout'
      });
      
      // Force logout as fallback
      navigate('/login');
    }
  }, [navigate]);

  const handleRemoveDocument = useCallback(async (documentId: string) => {
    try {
      await unlinkDocument(documentId);
    } catch (error) {
      await handleError(error, {
        component: 'Chat',
        action: 'handleRemoveDocument',
        documentId,
        conversationId: currentConversation?.id
      });
    }
  }, [unlinkDocument, currentConversation?.id]);

  const handleWebsiteImport = useCallback(() => {
    setWebsiteImportOpen(true);
  }, []);

  if (!session?.user) {
    navigate('/login');
    return null;
  }

  const isAdminOrSuperAdmin = userRole === 'admin' || userRole === 'super_admin' || userRole === 'g_admin';
  const isSuperAdmin = userRole === 'super_admin';
  const isGAdmin = userRole === 'g_admin';

  const headerButtons = (
    <div className="flex items-center gap-2">
      {isAdminOrSuperAdmin && (
        <>
          {isSuperAdmin && (
            <>
              <button 
                onClick={() => setErrorLogOpen(true)}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
                title="Journal des erreurs"
              >
                <AlertTriangle size={18} strokeWidth={2.5} />
              </button>
              <button 
                onClick={() => setUserModalOpen(true)}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
                title="Gestion des utilisateurs"
              >
                <Users size={18} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => setCreateUserOpen(true)}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
                title="Créer un utilisateur"
              >
                <UserPlus size={18} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => setAddUserOpen(true)}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
                title="Inviter un utilisateur"
              >
                <Settings size={18} strokeWidth={2.5} />
              </button>
            </>
          )}
          <button 
            onClick={() => setDocumentModalOpen(true)}
            className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
            title="Importer un document"
          >
            <DocumentIcon />
          </button>
          <button 
            onClick={handleWebsiteImport}
            className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
            title="Importer depuis le web"
          >
            <Globe size={18} strokeWidth={2.5} />
          </button>
          <button 
            onClick={() => setFileManagementOpen(true)}
            className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
            title="Gestion des fichiers"
          >
            <DocumentListIcon />
          </button>
          <button 
            onClick={() => setTemplateManagerOpen(true)}
            className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
            title="Modèles de rapports"
          >
            <FileSpreadsheet size={18} strokeWidth={2.5} />
          </button>
          {isSuperAdmin && <FeedbackManager />}
        </>
      )}
    </div>
  );

  const messageList = messages.map((message, index) => (
    <MessageItem
      key={message.id}
      message={message}
      isLatestAssistantMessage={index === lastAssistantMessageIndex}
    />
  ));

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      <header className="bg-[#f15922] shadow-sm h-16 flex-shrink-0 flex items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Logo />
            <div className="flex items-center">
              <strong className="text-2xl">RINGO</strong>
              <sup className="ml-1 flex items-center gap-0.5 text-sm text-white/80">
                <span>par</span>
                <SmallLogo />
              </sup>
              <div className="ml-2">
                <IrsstLogo />
              </div>
            </div>
          </h1>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleLogout}
              className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
              title="Se déconnecter"
            >
              <LogOut size={18} strokeWidth={2.5} />
            </button>
            <div className="border-l border-white/20 pl-4 flex flex-col">
              <span className="text-white/90 text-sm">{session.user.email}</span>
              {userRole === 'super_admin' ? (
                <span className="text-white/70 text-xs font-medium">S-Admin</span>
              ) : userRole === 'admin' ? (
                <span className="text-white/70 text-xs font-medium">Admin</span>
              ) : userRole === 'g_admin' ? (
                <span className="text-white/70 text-xs font-medium">G-Admin</span>
              ) : (
                <span className="text-white/70 text-xs font-medium">Utilisateur</span>
              )}
            </div>
          </div>
        </div>
        {headerButtons}
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-1/4 bg-[#dba747] border-r border-gray-200 overflow-hidden flex flex-col">
          <div className="p-4 flex-1 overflow-y-auto">
            <ConversationList />
          </div>
        </aside>

        <main className="flex-1 flex flex-col bg-white">
          <div className="flex-1 overflow-hidden flex flex-col">
            {currentConversation && (
              <DocumentList 
                documents={conversationDocuments}
                onRemove={handleRemoveDocument}
              />
            )}
            
            <div 
              className="flex-1 overflow-y-auto p-4"
              ref={messagesContainerRef}
            >
              {!currentConversation ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <div className="w-32 h-32 mb-4 text-[#106f69]">
                    <Logo />
                  </div>
                  <h2 className="text-2xl font-bold text-[#f15922] mb-2">
                    Prêt.e à mettre du rythme dans vos données ?!
                  </h2>
                  <p className="text-gray-600 text-center">
                    Alors cliquez sur la base de données en bas à gauche et choisissez un premier document...
                  </p>
                </div>
              ) : (
                <>
                  {messageList}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex-shrink-0 p-4 bg-gradient-to-t from-white via-white to-transparent">
              <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFileExplorerOpen(true)}
                  className="chat-neumorphic-button flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-700 focus:outline-none"
                  aria-label="Open file explorer"
                >
                  <Database size={20} />
                </button>
                <div className="relative flex-grow">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      adjustTextareaHeight();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                    placeholder={currentConversation ? "Envoyez un message..." : "Sélectionnez une conversation pour commencer"}
                    className="chat-input w-full pl-4 pr-12 py-3 max-h-[200px] resize-none focus:outline-none bg-white"
                    rows={1}
                    disabled={!currentConversation}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isTyping || !currentConversation}
                    className="send-button absolute right-3 top-1/2 -translate-y-1/2"
                    aria-label="Send message"
                  >
                    <ArrowRight 
                      size={20} 
                      className="text-[#f15922]" 
                    />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>

      {currentConversation && conversationDocuments.length > 0 && (
        <ReportGeneratorWidget />
      )}

      <FeedbackButton />

      <UserManagementModal />
      <DocumentImportModal />
      <FileManagementModal
        isOpen={isFileManagementOpen}
        onClose={() => setFileManagementOpen(false)}
      />
      <FileExplorer
        isOpen={isFileExplorerOpen}
        onClose={() => setFileExplorerOpen(false)}
      />
      <ReportTemplateManager
        isOpen={isTemplateManagerOpen}
        onClose={() => setTemplateManagerOpen(false)}
      />
      <WebContentImporter
        isOpen={isWebsiteImportOpen}
        onClose={() => setWebsiteImportOpen(false)}
      />
      {isSuperAdmin && (
        <>
          <ErrorLogViewer
            isOpen={isErrorLogOpen}
            onClose={() => setErrorLogOpen(false)}
          />
          <CreateUserModal
            isOpen={isCreateUserOpen}
            onClose={() => setCreateUserOpen(false)}
            onSuccess={() => {}}
          />
          <AddUserModal />
        </>
      )}
    </div>
  );
}