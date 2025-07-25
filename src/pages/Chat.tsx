import React, { useState, useEffect, useRef } from 'react';
import { Users, ArrowRight, LogOut, Database, FileText, Globe, AlertTriangle, Settings, Clock, Lightbulb, BarChart3, Search, Target, Table } from 'lucide-react';
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
import { HelpRequestManager } from '../components/HelpRequestManager';
import { HelpRequestButton } from '../components/HelpRequestButton';
import { InactivityWarning } from '../components/InactivityWarning';
import { useInactivityTimeout } from '../hooks/useInactivityTimeout';
import { supabase, getUserRole } from '../lib/supabase';
import { useUserStore } from '../lib/store';
import { useDocumentStore } from '../lib/documentStore';
import { useConversationStore } from '../lib/conversationStore';
import { logError } from '../lib/errorLogger';
import './Chat.css';

interface ChatProps {
  session: Session;
  userRole?: string;
  authInitialized?: boolean;
}

export function Chat({ session, userRole: propUserRole, authInitialized }: ChatProps) {
  const [input, setInput] = useState('');
  const [userRole, setUserRole] = useState<string>(propUserRole || 'user');
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

  // Hook pour la déconnexion automatique
  const { showWarning, remainingTime, continueSession } = useInactivityTimeout();

  // Get the last assistant message index
  const lastAssistantMessageIndex = messages
    .map((m, i) => ({ ...m, index: i }))
    .filter(m => m.sender === 'assistant')
    .pop()?.index;

  useEffect(() => {
    // Only fetch user role if not provided as prop
    if (!propUserRole && !authInitialized) {
      const fetchUserRole = async () => {
        const maxRetries = 3;
        const baseDelay = 1000; // 1 second

        const retryFetch = async (attempt: number = 1): Promise<void> => {
          try {
            console.log(`Chat component fetching user role (attempt ${attempt})...`);
            const role = await getUserRole();
            if (role) {
              console.log('Chat component received role:', role);
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
    } else if (propUserRole) {
      // Use the role provided as prop
      console.log('Using provided user role:', propUserRole);
      setUserRole(propUserRole);
    }
    
    fetchConversations();
  }, [session, fetchConversations, propUserRole, authInitialized]);

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
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px'; // Reduced max height
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
          <div className="flex items-center gap-2">
            <button 
              onClick={handleLogout}
              className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-white/90 focus:outline-none"
              aria-label="Logout"
              title="Déconnexion"
            >
              <LogOut size={18} strokeWidth={2.5} />
            </button>
            <HelpRequestButton />
            <div className="border-l border-white/20 pl-4 flex flex-col">
              <span className="text-white/90 text-sm">{session.user.email}</span>
              {userRole === 'super_admin' ? (
                <span className="text-white/70 text-xs">S-Admin</span>
              ) : userRole === 'admin' ? (
                <span className="text-white/70 text-xs">Admin</span>
              ) : (
                <span className="text-white/70 text-xs">Utilisateur</span>
              )}
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
                title="Gestion des utilisateurs"
              >
                <Users size={18} strokeWidth={2.5} />
              </button>
              <HelpRequestManager />
            </>
          )}
          {/* Show document management buttons to both admin and super admin */}
          {isAdminOrSuperAdmin && (
            <>
              <button 
                onClick={() => setDocumentModalOpen(true)}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-white/90 focus:outline-none"
                aria-label="Document import"
                title="Importer un document"
              >
                <DocumentIcon />
              </button>
              <button 
                onClick={handleWebsiteImport}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-white/90 focus:outline-none"
                aria-label="Website import"
                title="Importer du contenu web"
              >
                <Globe size={18} strokeWidth={2.5} />
              </button>
              <button 
                onClick={() => setFileManagementOpen(true)}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-white/90 focus:outline-none"
                aria-label="File management"
                title="Gestion des fichiers"
              >
                <DocumentListIcon />
              </button>
              <button 
                onClick={() => setTemplateManagerOpen(true)}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-white/90 focus:outline-none"
                aria-label="Report templates"
                title="Modèles de rapports"
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
                  <p className="text-gray-600 text-center mb-6">
                    Alors cliquez sur la base de données en bas à gauche et choisissez un premier document...
                  </p>
                  <div className="max-w-2xl text-sm text-gray-500 space-y-2">
                    <p className="flex items-center gap-2">
                      <Lightbulb size={16} className="text-[#f15922]" />
                      <span>Vous pouvez sélectionner plusieurs documents pour une analyse croisée</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <BarChart3 size={16} className="text-[#f15922]" />
                      <span>Demandez-moi de comparer, synthétiser ou croiser vos documents</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Search size={16} className="text-[#f15922]" />
                      <span>Je peux créer des tableaux comparatifs et des synthèses consolidées</span>
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.length === 0 && conversationDocuments.length > 1 && (
                    <div className="max-w-3xl mx-auto mt-8 p-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Target size={20} className="text-[#f15922]" />
                        Analyse multi-documents activée
                      </h3>
                      <p className="text-gray-700 mb-4">
                        J'ai accès à {conversationDocuments.length} documents. Voici ce que je peux faire pour vous :
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button
                          onClick={() => setInput("Compare les informations clés de tous les documents")}
                          className="text-left p-3 bg-white rounded-lg hover:shadow-md transition-shadow border border-gray-200"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <BarChart3 size={18} className="text-[#f15922]" />
                            <span className="font-medium text-gray-800">Comparaison</span>
                          </div>
                          <p className="text-sm text-gray-600">Identifier les similitudes et différences</p>
                        </button>
                        <button
                          onClick={() => setInput("Fais une synthèse consolidée de tous les documents")}
                          className="text-left p-3 bg-white rounded-lg hover:shadow-md transition-shadow border border-gray-200"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <FileText size={18} className="text-[#f15922]" />
                            <span className="font-medium text-gray-800">Synthèse</span>
                          </div>
                          <p className="text-sm text-gray-600">Résumer les points essentiels</p>
                        </button>
                        <button
                          onClick={() => setInput("Crée un tableau comparatif des données principales")}
                          className="text-left p-3 bg-white rounded-lg hover:shadow-md transition-shadow border border-gray-200"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Table size={18} className="text-[#f15922]" />
                            <span className="font-medium text-gray-800">Tableau</span>
                          </div>
                          <p className="text-sm text-gray-600">Visualiser les données côte à côte</p>
                        </button>
                        <button
                          onClick={() => setInput("Identifie les contradictions ou incohérences entre les documents")}
                          className="text-left p-3 bg-white rounded-lg hover:shadow-md transition-shadow border border-gray-200"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Search size={18} className="text-[#f15922]" />
                            <span className="font-medium text-gray-800">Analyse critique</span>
                          </div>
                          <p className="text-sm text-gray-600">Détecter les contradictions</p>
                        </button>
                      </div>
                    </div>
                  )}
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

            <div className="flex-shrink-0 p-3 bg-gradient-to-t from-white via-white to-transparent">
              <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFileExplorerOpen(true)}
                  className="chat-neumorphic-button flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-700 focus:outline-none"
                  aria-label="Open file explorer"
                >
                  <Database size={18} />
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
                    className="chat-input w-full pl-4 pr-12 py-2 max-h-[120px] resize-none focus:outline-none bg-white"
                    rows={1}
                    disabled={!currentConversation}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isTyping || !currentConversation}
                    className="send-button"
                    aria-label="Envoyer le message"
                  >
                    <ArrowRight 
                      size={20} 
                      className="text-[#f15922]" 
                    />
                  </button>
                </div>
                {currentConversation && conversationDocuments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setReportManagerOpen(true)}
                    className="chat-neumorphic-button flex-shrink-0 h-10 px-3 py-2 rounded-lg flex items-center gap-2 text-[#f15922]"
                  >
                    <FileText size={18} />
                    <span className="font-medium">Rapports</span>
                  </button>
                )}
              </form>
            </div>
          </div>
        </main>
      </div>

      <FeedbackButton />

      {/* Only render user management modal for super admin */}
      {isSuperAdmin && <UserManagementModal />}
      
      {/* Render document import modal for admin and super admin */}
      {isAdminOrSuperAdmin && <DocumentImportModal />}
      
      {/* File explorer should be available to all users */}
      <FileExplorer
        isOpen={isFileExplorerOpen}
        onClose={() => setFileExplorerOpen(false)}
      />
      
      {/* Render other admin-only modals */}
      {isAdminOrSuperAdmin && (
        <>
          <FileManagementModal
            isOpen={isFileManagementOpen}
            onClose={() => setFileManagementOpen(false)}
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

      {/* Report Manager should be available to all users */}
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
      
      {/* Avertissement d'inactivité */}
      {showWarning && (
        <InactivityWarning
          remainingTime={remainingTime}
          onContinue={continueSession}
          onClose={continueSession}
        />
      )}
    </div>
  );
}