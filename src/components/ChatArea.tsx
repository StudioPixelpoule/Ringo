import React, { useState, useEffect, useRef } from 'react';
import { FileText, ChevronDown, Database, ArrowRight, X } from 'lucide-react';
import { Logo } from './Logo';
import { MessageItem } from './MessageItem';
import { VirtualizedMessageList } from './VirtualizedMessageList';
import { ChatTimelineNav } from './ChatTimelineNav';
import { useConversationStore } from '../lib/conversationStore';

interface ChatAreaProps {
  setFileExplorerOpen: (open: boolean) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ setFileExplorerOpen }) => {
  const [input, setInput] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevMessagesCountRef = useRef(0);
  
  const {
    messages,
    isTyping,
    currentConversation,
    documents: conversationDocuments,
    sendMessage,
    unlinkDocument
  } = useConversationStore();
  
  // Scroll to specific message
  const scrollToMessage = (messageId: string) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setUserHasScrolled(true);
    }
  };
  
  // Improved scroll detection with larger threshold
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 150;
    
    setShowScrollButton(!isScrolledToBottom);
    if (isScrolledToBottom) {
      setUserHasScrolled(false);
    } else if (messages.length > 0) {
      setUserHasScrolled(true);
    }
  };
  
  // Improved automatic scroll behavior
  useEffect(() => {
    // Don't scroll if user has scrolled up, except for new user messages
    const lastMessage = messages[messages.length - 1];
    const isNewUserMessage = lastMessage && 
                           lastMessage.sender === 'user' && 
                           messages.length > prevMessagesCountRef.current;
    
    if (!userHasScrolled || isNewUserMessage) {
      scrollToBottom();
    }
    
    prevMessagesCountRef.current = messages.length;
  }, [messages, isTyping]);
  
  const scrollToBottom = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollHeight, clientHeight } = messagesContainerRef.current;
    const maxScroll = scrollHeight - clientHeight;
    
    messagesContainerRef.current.scrollTo({
      top: maxScroll,
      behavior: 'smooth'
    });
    
    setShowScrollButton(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping || !currentConversation) return;
    
    const content = input.trim();
    setInput('');
    setUserHasScrolled(false);

    try {
      await sendMessage(content);
      inputRef.current?.focus();
      scrollToBottom();
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

  const handleRemoveDocument = async (documentId: string) => {
    try {
      await unlinkDocument(documentId);
    } catch (error) {
      console.error('Error removing document:', error);
    }
  };
  
  return (
    <div className="chat-container">
      {/* Documents attachés */}
      {currentConversation && conversationDocuments.length > 0 && (
        <div className="documents-container">
          <div className="documents-header">
            <FileText size={16} />
            <span>Documents attachés :</span>
          </div>
          <div className="documents-list">
            {conversationDocuments.map((doc) => (
              <div key={doc.document_id} className="document-tag">
                <span className="truncate max-w-[200px]">{doc.documents.name}</span>
                <button
                  onClick={() => handleRemoveDocument(doc.document_id)}
                  className="p-0.5 hover:bg-[#f15922]/20 rounded-full"
                  title="Retirer le document"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Zone des messages avec timeline */}
      <div className="flex flex-1 overflow-hidden">
        {currentConversation && messages.length > 0 && (
          <ChatTimelineNav 
            messages={messages}
            onTimelineClick={scrollToMessage}
          />
        )}
        
        <div 
          className="messages-area flex-1"
          ref={messagesContainerRef}
          onScroll={handleScroll}
        >
          {!currentConversation ? (
            <div className="empty-state">
              <div className="empty-state-logo">
                <Logo />
              </div>
              <h2 className="empty-state-title">
                Prêt.e à mettre du rythme dans vos données ?!
              </h2>
              <p className="empty-state-text">
                Ajoutez un document en cliquant sur le bouton en bas à gauche et commencez la conversation.
              </p>
            </div>
          ) : (
            <VirtualizedMessageList messages={messages} />
          )}
          
          {isTyping && (
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Bouton de défilement */}
      <button
        className={`scroll-to-bottom ${showScrollButton ? 'visible' : ''}`}
        onClick={scrollToBottom}
        aria-label="Défiler vers le bas"
      >
        <ChevronDown size={20} />
      </button>
      
      {/* Zone de saisie */}
      <div className="chat-input-wrapper">
        <form onSubmit={handleSubmit} className="chat-input-container">
          <button
            type="button"
            onClick={() => setFileExplorerOpen(true)}
            className="file-button"
            aria-label="Ajouter un document"
          >
            <Database size={20} />
          </button>
          
          <div className="input-field-container">
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
              className="input-field"
              rows={1}
              disabled={!currentConversation || isTyping}
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping || !currentConversation}
              className="send-button"
              aria-label="Envoyer le message"
            >
              <ArrowRight size={20} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};