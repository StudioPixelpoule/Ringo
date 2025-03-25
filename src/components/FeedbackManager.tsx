import React, { useState, useEffect } from 'react';
import { MessageSquare, X, Check, Archive, Trash2, Users, Send, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface Feedback {
  id: string;
  content: string;
  created_at: string;
  status: 'unread' | 'read' | 'archived';
  email: string;
}

export function FeedbackManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read' | 'archived'>('all');
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    feedback: Feedback | null;
    isDeleting: boolean;
  }>({
    isOpen: false,
    feedback: null,
    isDeleting: false
  });

  useEffect(() => {
    if (isOpen) {
      fetchFeedback();
    }
  }, [isOpen]);

  useEffect(() => {
    // Subscribe to realtime updates
    const channel = supabase
      .channel('feedback_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_feedback'
        },
        () => {
          fetchFeedback();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchFeedback = async () => {
    try {
      const { data, error } = await supabase
        .from('feedback_with_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setFeedback(data || []);
      setUnreadCount(data?.filter(f => f.status === 'unread').length || 0);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: 'read' | 'archived') => {
    try {
      const { error } = await supabase
        .from('user_feedback')
        .update({ 
          status,
          ...(status === 'read' ? { read_at: new Date().toISOString() } : {})
        })
        .eq('id', id);

      if (error) throw error;

      await fetchFeedback();
    } catch (error) {
      console.error('Error updating feedback status:', error);
    }
  };

  const handleDeleteClick = (feedback: Feedback) => {
    setDeleteConfirmation({
      isOpen: true,
      feedback,
      isDeleting: false
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation.feedback) return;

    try {
      setDeleteConfirmation(prev => ({ ...prev, isDeleting: true }));

      const { error } = await supabase
        .from('user_feedback')
        .delete()
        .eq('id', deleteConfirmation.feedback.id);

      if (error) throw error;

      await fetchFeedback();
      setDeleteConfirmation({ isOpen: false, feedback: null, isDeleting: false });
    } catch (error) {
      console.error('Error deleting feedback:', error);
      setDeleteConfirmation(prev => ({ ...prev, isDeleting: false }));
    }
  };

  const filteredFeedback = feedback.filter(item => {
    if (statusFilter === 'all') return true;
    return item.status === statusFilter;
  });

  return (
    <>
      {/* Feedback button with notification badge */}
      <button 
        onClick={() => setIsOpen(true)}
        className="relative header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
      >
        <MessageSquare size={18} strokeWidth={2.5} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Feedback modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
            <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <MessageSquare size={24} />
                Retours Utilisateurs
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center gap-4">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                >
                  <option value="all">Tous les retours</option>
                  <option value="unread">Non lus</option>
                  <option value="read">Lus</option>
                  <option value="archived">Archivés</option>
                </select>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6">
              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  Chargement...
                </div>
              ) : filteredFeedback.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Aucun retour utilisateur pour le moment
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredFeedback.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-lg border ${
                        item.status === 'unread'
                          ? 'bg-blue-50 border-blue-200'
                          : item.status === 'archived'
                          ? 'bg-gray-50 border-gray-200'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-gray-600">
                              {item.email}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(item.created_at).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap">{item.content}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.status === 'unread' && (
                            <button
                              onClick={() => handleStatusChange(item.id, 'read')}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="Marquer comme lu"
                            >
                              <Check size={18} />
                            </button>
                          )}
                          {item.status !== 'archived' && (
                            <button
                              onClick={() => handleStatusChange(item.id, 'archived')}
                              className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                              title="Archiver"
                            >
                              <Archive size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteClick(item)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Supprimer définitivement"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        title="Supprimer le retour utilisateur"
        message={`Êtes-vous sûr de vouloir supprimer définitivement le retour de ${deleteConfirmation.feedback?.email} ? Cette action est irréversible.`}
        confirmLabel="Supprimer définitivement"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmation({ isOpen: false, feedback: null, isDeleting: false })}
        isDeleting={deleteConfirmation.isDeleting}
      />
    </>
  );
}