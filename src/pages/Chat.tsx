import React, { useState, useRef, useEffect } from 'react';
import { Users, ArrowRight, Plus, LogOut, Database } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { Logo } from '../components/Logo';
import { DocumentIcon } from '../components/DocumentIcon';
import { DocumentListIcon } from '../components/DocumentListIcon';
import { UserManagementModal } from '../components/UserManagementModal';
import { DocumentImportModal } from '../components/DocumentImportModal';
import { MindmapModal } from '../components/MindmapModal';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../lib/store';
import { useDocumentStore, Document } from '../lib/documentStore';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  isTyping?: boolean;
}

export function Chat({ session }: { session: Session }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userRole, setUserRole] = useState<string>('user');
  const [isMindmapOpen, setIsMindmapOpen] = useState(false);
  const { setModalOpen } = useUserStore();
  const { setModalOpen: setDocModalOpen } = useDocumentStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setUserRole(data.role);
      }
    };

    fetchUserRole();
  }, [session]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      isUser: true
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "This is a simulated response that demonstrates the typing effect of the chat interface. It appears character by character, just like in ChatGPT.",
        isUser: false,
        isTyping: true
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1000);
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

  const handleDocumentSelect = (document: Document) => {
    setInput(`Référence au document: ${document.name}`);
    setIsMindmapOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-[#f15922] shadow-sm h-16 flex items-center justify-between px-6">
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
              onClick={() => setModalOpen(true)}
              className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-white/90 focus:outline-none"
              aria-label="User management"
            >
              <Users size={18} strokeWidth={2.5} />
            </button>
          )}
          {userRole === 'admin' && (
            <>
              <button 
                onClick={() => setDocModalOpen(true)}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-white/90 focus:outline-none"
                aria-label="Document import"
              >
                <DocumentIcon />
              </button>
              <button 
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-white/90 focus:outline-none"
                aria-label="Document list"
              >
                <DocumentListIcon />
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 flex">
        <aside className="w-1/4 bg-[#dba747] border-r border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium text-white">Conversations</h2>
            <button 
              className="neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-white/90 focus:outline-none"
              aria-label="New conversation"
            >
              <Plus size={20} strokeWidth={2.5} />
            </button>
          </div>
          <nav className="space-y-2">
          </nav>
        </aside>

        <main className="w-2/4 flex flex-col bg-white relative">
          <div className="flex-1 p-4 overflow-y-auto pb-32">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`mb-6 ${message.isUser ? 'pl-12' : 'pr-12'} message-appear`}
              >
                <div className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`rounded-lg px-4 py-2 max-w-[90%] ${
                      message.isUser
                        ? 'bg-[#f15922] text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <p className={message.isTyping ? 'typing-cursor' : ''}>
                      {message.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent">
            <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMindmapOpen(true)}
                className="chat-neumorphic-button flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-700 focus:outline-none"
                aria-label="Open mindmap"
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
                  placeholder="Send a message..."
                  className="chat-input w-full pl-4 pr-12 py-3 max-h-[200px] resize-none focus:outline-none bg-white"
                  rows={1}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="send-button absolute right-3 top-1/2 -translate-y-1/2 disabled:opacity-30 disabled:translate-x-0 disabled:scale-100"
                  aria-label="Send message"
                >
                  <ArrowRight 
                    size={20} 
                    className="text-[#f15922] transition-all duration-300 ease-in-out transform group-hover:translate-x-1" 
                  />
                </button>
              </div>
            </form>
          </div>
        </main>

        <aside className="w-1/4 bg-[#cfd3bd] border-l border-gray-200 p-4">
          <h2 className="text-xl font-medium text-gray-700">Rapports</h2>
        </aside>
      </div>

      <UserManagementModal />
      <DocumentImportModal />
      <MindmapModal
        isOpen={isMindmapOpen}
        onClose={() => setIsMindmapOpen(false)}
        onSelectDocument={handleDocumentSelect}
      />
    </div>
  );
}