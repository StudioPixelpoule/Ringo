import React, { useState } from 'react';
import { Edit2, Trash2, MessageSquare } from 'lucide-react';
import { useConversationStore, Conversation } from '../lib/conversationStore';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

export function ConversationList() {
  const {
    conversations,
    currentConversation,
    createConversation,
    deleteConversation,
    updateConversationTitle,
    setCurrentConversation,
  } = useConversationStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    conversation: Conversation | null;
  }>({
    isOpen: false,
    conversation: null,
  });

  const handleCreateConversation = async () => {
    try {
      const conversation = await createConversation('Nouvelle conversation');
      setCurrentConversation(conversation);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleStartEditing = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditingTitle(conversation.title);
  };

  const handleSaveEdit = async (id: string) => {
    if (editingTitle.trim()) {
      await updateConversationTitle(id, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const handleDeleteClick = (conversation: Conversation) => {
    setDeleteConfirmation({
      isOpen: true,
      conversation,
    });
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmation.conversation) {
      await deleteConversation(deleteConfirmation.conversation.id);
    }
    setDeleteConfirmation({ isOpen: false, conversation: null });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-medium text-white">Conversations</h2>
        <button
          onClick={handleCreateConversation}
          className="neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white hover:text-white/90 focus:outline-none"
          aria-label="Nouvelle conversation"
        >
          <MessageSquare size={20} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            className={`group relative rounded-lg p-3 cursor-pointer transition-all ${
              currentConversation?.id === conversation.id
                ? 'bg-white/20 text-white'
                : 'hover:bg-white/10 text-white/90'
            }`}
            onClick={() => setCurrentConversation(conversation)}
          >
            {editingId === conversation.id ? (
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={() => handleSaveEdit(conversation.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit(conversation.id);
                  if (e.key === 'Escape') {
                    setEditingId(null);
                    setEditingTitle('');
                  }
                }}
                className="w-full bg-white/20 text-white border-none rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white/50"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className="flex items-center justify-between">
                <span className="truncate">{conversation.title}</span>
                <div className="hidden group-hover:flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEditing(conversation);
                    }}
                    className="p-1 text-white/70 hover:text-white hover:bg-white/20 rounded"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(conversation);
                    }}
                    className="p-1 text-white/70 hover:text-white hover:bg-white/20 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <DeleteConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        title="Supprimer la conversation"
        message={`Êtes-vous sûr de vouloir supprimer la conversation "${deleteConfirmation.conversation?.title}" ? Cette action est irréversible.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmation({ isOpen: false, conversation: null })}
      />
    </div>
  );
}