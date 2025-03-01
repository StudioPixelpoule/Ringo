import React, { useState, useRef, useEffect } from 'react';
import { Plus, MessageSquare, Trash2, Edit2 } from 'lucide-react';
import { Conversation } from '../lib/types';

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onCreateConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onUpdateConversationTitle: (id: string, title: string) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
  onUpdateConversationTitle
}) => {
  const [hoveredConversation, setHoveredConversation] = useState<string | null>(null);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingConversationId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingConversationId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const handleStartEditing = (conversation: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConversationId(conversation.id);
    setEditTitle(conversation.title);
  };

  const handleSaveTitle = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingConversationId && editTitle.trim()) {
      onUpdateConversationTitle(editingConversationId, editTitle.trim());
      setEditingConversationId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditingConversationId(null);
    }
  };

  const handleClickOutside = (e: React.MouseEvent) => {
    if (editingConversationId && editInputRef.current && !editInputRef.current.contains(e.target as Node)) {
      handleSaveTitle(e);
    }
  };

  // Function to clean markdown from title for display
  const cleanTitle = (title: string) => {
    // If title contains markdown formatting for document sharing
    if (title.includes('**Document partagé:**')) {
      // Extract the document name from the markdown
      const docName = title.replace('**Document partagé:** ', '');
      return `Document: ${docName}`;
    }
    
    return title;
  };

  return (
    <div className="bg-[#cfd3bd] h-full p-4 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-[#2F4F4F] text-lg font-medium">Conversations</h2>
        <button 
          onClick={onCreateConversation}
          className="btn-neumorphic bg-[#cfd3bd] text-[#2F4F4F] p-3 rounded-full hover:text-[#2F4F4F] focus:outline-none transition-all duration-300"
          title="Nouvelle conversation"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="text-[#2F4F4F] text-center mt-20">
            <p className="mb-4">Aucune conversation, appuies sur "+" pour commencer...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`
                  relative group rounded-lg p-3 cursor-pointer transition-all duration-300
                  ${activeConversationId === conversation.id
                    ? 'bg-[#2F4F4F] text-white shadow-sm'
                    : 'hover:bg-[#bfc3ad] text-[#2F4F4F]'
                  }
                `}
                onClick={() => onSelectConversation(conversation.id)}
                onMouseEnter={() => setHoveredConversation(conversation.id)}
                onMouseLeave={() => setHoveredConversation(null)}
              >
                <div className="flex items-start gap-3">
                  <MessageSquare 
                    size={18} 
                    className={activeConversationId === conversation.id ? 'text-white' : 'text-[#2F4F4F]'} 
                  />
                  <div className="flex-1 min-w-0 pr-16"> {/* Added right padding to make space for buttons */}
                    {editingConversationId === conversation.id ? (
                      <form onSubmit={handleSaveTitle} onClick={(e) => e.stopPropagation()}>
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={handleSaveTitle}
                          className="w-full px-2 py-1 text-[#2F4F4F] bg-white rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#f15922]"
                          autoFocus
                        />
                      </form>
                    ) : (
                      <>
                        <div 
                          className="font-medium truncate"
                          onDoubleClick={(e) => handleStartEditing(conversation, e)}
                        >
                          {cleanTitle(conversation.title)}
                        </div>
                        <div className="text-xs opacity-70">{formatDate(conversation.created_at)}</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Action buttons container - positioned absolutely */}
                {(hoveredConversation === conversation.id || activeConversationId === conversation.id) && !editingConversationId && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                    <button
                      onClick={(e) => handleStartEditing(conversation, e)}
                      className={`
                        p-1.5 rounded-full transition-all duration-300
                        ${activeConversationId === conversation.id
                          ? 'hover:bg-white/20 text-white'
                          : 'hover:bg-[#2F4F4F]/10 text-[#2F4F4F]'
                        }
                      `}
                      title="Renommer la conversation"
                    >
                      <Edit2 size={16} />
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conversation.id);
                      }}
                      className={`
                        p-1.5 rounded-full transition-all duration-300
                        ${activeConversationId === conversation.id
                          ? 'hover:bg-white/20 text-white'
                          : 'hover:bg-[#2F4F4F]/10 text-[#2F4F4F]'
                        }
                      `}
                      title="Supprimer la conversation"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};