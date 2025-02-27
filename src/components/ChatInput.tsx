import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { MindMapIcon } from './MindMapIcon';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onOpenMindMap: () => void;
  isLoading: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  onOpenMindMap,
  isLoading
}) => {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Ajuster automatiquement la hauteur du textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message);
      setMessage('');
      
      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="bg-[#f15922] p-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <button 
          type="button"
          onClick={onOpenMindMap}
          className="btn-neumorphic bg-[#3C584E] p-3 rounded-full transition-all duration-300"
          title="Voir la mind map"
        >
          <MindMapIcon className="text-white" size={20} />
        </button>
        
        <div className="relative flex-1">
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez votre question à Ringo..."
            className="w-full px-4 py-2 rounded-lg bg-[#FFCDB6] text-[#2F4F4F] placeholder-[#2F4F4F] outline-none resize-none min-h-[40px] max-h-[120px] transition-all duration-300"
            rows={1}
            disabled={isLoading}
          />
        </div>
        
        <button 
          type="submit" 
          className={`
            btn-neumorphic bg-[#3C584E] p-3 rounded-full transition-all duration-300
            ${isLoading || !message.trim() ? 'opacity-50 cursor-not-allowed' : 'opacity-100'}
          `}
          disabled={isLoading || !message.trim()}
        >
          <Send className="text-white" size={20} />
        </button>
      </form>
    </div>
  );
};