import React, { useState, useEffect, useRef } from 'react';
import { Users, ArrowRight, LogOut, Database, FileText, Globe, AlertTriangle, Settings } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
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
import { ReportManager } from '../components/ReportManager';
import { ReportTemplateManager } from '../components/ReportTemplateManager';
import { FeedbackButton } from '../components/FeedbackButton';
import { FeedbackManager } from '../components/FeedbackManager';
import { WebContentImporter } from '../components/WebContentImporter';
import { ErrorLogViewer } from '../components/ErrorLogViewer';
import { supabase, getUserRole } from '../lib/supabase';
import { useUserStore } from '../lib/store';
import { useDocumentStore } from '../lib/documentStore';
import { useConversationStore } from '../lib/conversationStore';
import { logError } from '../lib/errorLogger';
import './Chat.css';

interface ChatProps {
  session: Session;
}

export function Chat({ session }: ChatProps) {
  const [input, setInput] = useState('');
  const [userRole, setUserRole] = useState<string>('user');
  const [isFileExplorerOpen, setFileExplorerOpen] = useState(false);
  const [isFileManagementOpen, setFileManagementOpen] = useState(false);
  const [isTemplateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [isWebsiteImportOpen, setWebsiteImportOpen] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [isErrorLogOpen, setErrorLogOpen] = useState(false);
  const [isReportManagerOpen, setReportManagerOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const { setModalOpen: setUserModalOpen } = useUserStore();
  const { setModalOpen: setDocumentModalOpen } = useDocumentStore();
  const {
    messages,
    currentConversation,
    documents: conversationDocuments,
    isTyping,
    sendMessage,
    fetchConversations,
    unlinkDocument,
  } = useConversationStore();

  // Get the last assistant message index
  const lastAssistantMessageIndex = messages
    .map((m, i) => ({ ...m, index: i }))
    .filter(m => m.sender === 'assistant')
    .pop()?.index;

  useEffect(() => {
    const fetchUserRole = async () => {
      const maxRetries = 3;
      const baseDelay = 1000; // 1 second

      const retryFetch = async (attempt: number = 1): Promise<void> => {
        try {
          const role = await getUserRole();
          if (role) {
            setUserRole(role);
          } else {
            throw new Error('Failed to get user role');
          }
        } catch (error) {
          // Log the error for debugging
          console.error(`Attempt ${attempt} failed:`, error);

          // Check if we should retry
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryFetch(attempt + 1);
          }

          // If all retries failed, check error type
          if (error instanceof Error) {
            if (error.message.includes('JWT expired') || 
                error.message.includes('Invalid JWT') ||
                error.message.includes('Failed to fetch')) {
              console.error('Authentication error:', error);
              window.location.href = '/login';
              return;
            }
            throw error;
          }
          throw new Error('Failed to fetch user role');
        }
      };

      try {
        await retryFetch();
      } catch (error) {
        console.error('All retries failed:', error);
        logError(error);
      }
    };

    fetchUserRole();
    fetchConversations();
  }, [session, fetchConversations]);

  // Handle scroll detection
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isScrolledToBottom = scrollHeight - scrollTop <= clientHeight + 50; // 50px margin
    
    if (!isScrolledToBottom) {
      setUserHasScrolled(true);
    } else {
      setUserHasScrolled(false);
    }
  };

  // Scroll to bottom only in specific conditions
  useEffect(() => {
    if (userHasScrolled) return;

    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, userHasScrolled]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping || !currentConversation) return;
    
    const content = input.trim();
    setInput('');
    setUserHasScrolled(false);

    try {
      await sendMessage(content);
      
      // Ensure input is focused after sending
      inputRef.current?.focus();
      
      // Scroll to bottom after sending
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const adjustTextareaHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
    }
  };

  const handleLogout = async () => {
    try {
      setUserRole('user');
      setInput('');
      setFileExplorerOpen(false);
      setFileManagementOpen(false);
      setTemplateManagerOpen(false);
      setWebsiteImportOpen(false);

      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error during logout:', error);
      window.location.href = '/login';
    }
  };

  const handleRemoveDocument = async (documentId: string) => {
    try {
      await unlinkDocument(documentId);
    } catch (error) {
      console.error('Error removing document:', error);
    }
  };

  const handleWebsiteImport = () => {
    setWebsiteImportOpen(true);
  };

  const isAdminOrSuperAdmin = userRole === 'admin' || userRole === 'super_admin';
  const isSuperAdmin = userRole === 'super_admin';

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
              className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-white/90 focus:outline-none"
              aria-label="Logout"
            >
              <LogOut size={18} strokeWidth={2.5} />
            </button>
            <div className="border-l border-white/20 pl-4 flex flex-col">
              <span className="text-white/90 text-sm">{session.user.email}</span>
              {userRole === 'super_admin' ? (
                <span className="text-white/70 text-xs">S-Admin</span>
              ) : userRole === 'admin' ? (
                <span className="text-white/70 text-xs">Admin</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Only show admin buttons to super admin */}
          {isSuperAdmin && (
            <>
              <button 
                onClick={() => setErrorLogOpen(true)}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
                title="Voir les erreurs système"
              >
                <AlertTriangle size={18} strokeWidth={2.5} />
              </button>
              <button 
                onClick={() => setUserModalOpen(true)}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-white/90 focus:outline-none"
                aria-label="User management"
              >
                <Users size={18} strokeWidth={2.5} />
              </button>
            </>
          )}
          {/* Show document management buttons to both admin and super admin */}
          {isAdminOrSuperAdmin && (
            <>
              <button 
                onClick={() => setDocumentModalOpen(true)}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-white/90 focus:outline-none"
                aria-label="Document import"
              >
                <DocumentIcon />
              </button>
              <button 
                onClick={handleWebsiteImport}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-white/90 focus:outline-none"
                aria-label="Website import"
              >
                <Globe size={18} strokeWidth={2.5} />
              </button>
              <button 
                onClick={() => setFileManagementOpen(true)}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-white/90 focus:outline-none"
                aria-label="File management"
              >
                <DocumentListIcon />
              </button>
              <button 
                onClick={() => setTemplateManagerOpen(true)}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-white/90 focus:outline-none"
                aria-label="Report templates"
              >
                <Settings size={18} strokeWidth={2.5} />
              </button>
              {/* Show feedback manager only to super admin */}
              {isSuperAdmin && <FeedbackManager />}
            </>
          )}
        </div>
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
              onScroll={handleScroll}
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
                  {messages.map((message, index) => (
                    <MessageItem
                      key={message.id}
                      message={message}
                      isLatestAssistantMessage={index === lastAssistantMessageIndex}
                    />
                  ))}
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
        <button
          onClick={() => setReportManagerOpen(true)}
          className="fixed bottom-24 right-8 z-10 flex items-center gap-2 bg-white p-3 rounded-full shadow-md hover:shadow-lg transition-all"
        >
          <FileText size={20} color="#f15922" />
          <span className="text-[#f15922] font-medium">Rapports</span>
        </button>
      )}

      <FeedbackButton />

      {/* Only render user management modal for super admin */}
      {isSuperAdmin && <UserManagementModal />}
      
      {/* Render other modals for admin and super admin */}
      {isAdminOrSuperAdmin && (
        <>
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
        </>
      )}

      {/* Report Manager */}
      <ReportManager
        isOpen={isReportManagerOpen}
        onClose={() => setReportManagerOpen(false)}
      />
      
      {/* Only render error log viewer for super admin */}
      {isSuperAdmin && (
        <ErrorLogViewer
          isOpen={isErrorLogOpen}
          onClose={() => setErrorLogOpen(false)}
        />
      )}
    </div>
  );
}