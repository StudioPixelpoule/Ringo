import React, { useState, useEffect } from 'react';
import { MessageSquare, X, Check, Archive } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

            <div className="max-h-[70vh] overflow-y-auto p-6">
              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  Chargement...
                </div>
              ) : feedback.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Aucun retour utilisateur pour le moment
                </div>
              ) : (
                <div className="space-y-4">
                  {feedback.map((item) => (
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
    </>
  );
}