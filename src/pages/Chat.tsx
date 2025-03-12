import React, { useState, useRef, useEffect } from 'react';
import { Users, ArrowRight, LogOut, Database } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { Logo } from '../components/Logo';
import { DocumentIcon } from '../components/DocumentIcon';
import { DocumentListIcon } from '../components/DocumentListIcon';
import { UserManagementModal } from '../components/UserManagementModal';
import { DocumentImportModal } from '../components/DocumentImportModal';
import { FileManagementModal } from '../components/FileManagementModal';
import { FileExplorer } from '../components/FileExplorer';
import { ConversationList } from '../components/ConversationList';
import { DocumentList } from '../components/DocumentList';
import { TypingIndicator } from '../components/TypingIndicator';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../lib/store';
import { useDocumentStore } from '../lib/documentStore';
import { useConversationStore } from '../lib/conversationStore';
import ReactMarkdown from 'react-markdown';

interface ChatProps {
  session: Session;
}

export function Chat({ session }: ChatProps) {
  const [input, setInput] = useState('');
  const [userRole, setUserRole] = useState<string>('user');
  const [isFileExplorerOpen, setFileExplorerOpen] = useState(false);
  const [isFileManagementOpen, setFileManagementOpen] = useState(false);
  
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data?.role) {
          setUserRole(data.role);
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    };

    fetchUserRole();
    fetchConversations();
  }, [session, fetchConversations]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping || !currentConversation) return;

    const content = input.trim();
    setInput('');

    try {
      await sendMessage(content);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleRemoveDocument = async (documentId: string) => {
    try {
      await unlinkDocument(documentId);
    } catch (error) {
      console.error('Error removing document:', error);
    }
  };

  const formatMessage = (content: string) => {
    return content
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mb-3 mt-4">$1</h2>')
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mb-2 mt-3">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[#f15922]">$1</strong>')
      .replace(/\n\n/g, '</p><p class="mb-3">');
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      <header className="bg-[#f15922] shadow-sm h-16 flex-shrink-0 flex items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Logo />
            <div className="flex items-baseline">
              <strong className="text-2xl">RINGO</strong>
              <sup className="text-xs ml-1">by AI</sup>
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
              {userRole === 'admin' && (
                <span className="text-white/70 text-xs">admin</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {userRole === 'admin' && (
            <button 
              onClick={() => setUserModalOpen(true)}
              className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-white/90 focus:outline-none"
              aria-label="User management"
            >
              <Users size={18} strokeWidth={2.5} />
            </button>
          )}
          {userRole === 'admin' && (
            <>
              <button 
                onClick={() => setDocumentModalOpen(true)}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-white/90 focus:outline-none"
                aria-label="Document import"
              >
                <DocumentIcon />
              </button>
              <button 
                onClick={() => setFileManagementOpen(true)}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-white/90 focus:outline-none"
                aria-label="File management"
              >
                <DocumentListIcon />
              </button>
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
            
            <div className="flex-1 overflow-y-auto p-4">
              {!currentConversation ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <div className="w-32 h-32 mb-4 text-[#106f69]">
                    <Logo />
                  </div>
                  <h2 className="text-2xl font-bold text-[#f15922] mb-2">
                    Prêt.e à mettre du rythme dans vos données ?!
                  </h2>
                  <p className="text-gray-600 text-center">
                    Alors cliquer sur la base de données en bas à gauche et choisis un premier document...
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`mb-6 ${message.sender === 'user' ? 'pl-12' : 'pr-12'} message-appear`}
                    >
                      <div className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`rounded-lg px-4 py-2 max-w-[90%] ${
                            message.sender === 'user'
                              ? 'bg-[#f15922] text-white'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {message.sender === 'user' ? (
                            <p>{message.content}</p>
                          ) : (
                            <div 
                              className="prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ 
                                __html: formatMessage(message.content)
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="pl-4">
                      <TypingIndicator />
                    </div>
                  )}
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
                    ref={textareaRef}
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
    </div>
  );
}