import React, { useState, useEffect } from 'react';
import { HelpCircle, X, Clock, CheckCircle, XCircle, Calendar, AlertTriangle, MessageSquare, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/errorLogger';

interface HelpRequest {
  id: string;
  user_id: string;
  message: string;
  availability: string;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  hours_spent: number | null;
  admin_notes: string | null;
  user_email: string;
}

export function HelpRequestManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<HelpRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all');
  const [adminNotes, setAdminNotes] = useState('');
  const [hoursSpent, setHoursSpent] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isOpen) {
      fetchRequests();
    }
  }, [isOpen, statusFilter]);

  useEffect(() => {
    // Subscribe to realtime updates
    const channel = supabase
      .channel('help_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'help_requests'
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    // Initial fetch to get unread count
    fetchUnreadCount();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const { count, error } = await supabase
        .from('help_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('help_requests_with_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter === 'pending') {
        query = query.eq('status', 'pending');
      } else if (statusFilter === 'active') {
        query = query.in('status', ['scheduled', 'in_progress']);
      } else if (statusFilter === 'completed') {
        query = query.in('status', ['completed', 'cancelled']);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setRequests(data || []);
      
      // Update unread count
      fetchUnreadCount();
    } catch (error) {
      console.error('Error fetching help requests:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch requests');
      logError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: HelpRequest['status']) => {
    setIsUpdating(true);
    try {
      const updates: Record<string, any> = { status };
      
      if (status === 'completed') {
        updates.resolved_at = new Date().toISOString();
        
        if (hoursSpent) {
          const hours = parseFloat(hoursSpent);
          if (!isNaN(hours) && hours > 0) {
            updates.hours_spent = hours;
          }
        }
        
        if (adminNotes.trim()) {
          updates.admin_notes = adminNotes.trim();
        }
      }

      const { error: updateError } = await supabase
        .from('help_requests')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;
      
      // Update local state
      setRequests(prev => 
        prev.map(req => 
          req.id === id 
            ? { ...req, ...updates } 
            : req
        )
      );
      
      if (selectedRequest?.id === id) {
        setSelectedRequest(prev => prev ? { ...prev, ...updates } : null);
      }
      
      // Clear form if completed
      if (status === 'completed') {
        setAdminNotes('');
        setHoursSpent('');
      }
    } catch (error) {
      console.error('Error updating request status:', error);
      setError(error instanceof Error ? error.message : 'Failed to update status');
      logError(error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusColor = (status: HelpRequest['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-purple-100 text-purple-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: HelpRequest['status']) => {
    switch (status) {
      case 'pending':
        return <Clock size={14} />;
      case 'scheduled':
        return <Calendar size={14} />;
      case 'in_progress':
        return <MessageSquare size={14} />;
      case 'completed':
        return <CheckCircle size={14} />;
      case 'cancelled':
        return <XCircle size={14} />;
      default:
        return null;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      {/* Help request button with notification badge */}
      <button 
        onClick={() => setIsOpen(true)}
        className="relative header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
      >
        <HelpCircle size={18} strokeWidth={2.5} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Help request modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 overflow-hidden flex flex-col"
            style={{ maxHeight: '85vh' }}
          >
            <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <HelpCircle size={24} />
                Demandes d'Assistance
              </h2>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setSelectedRequest(null);
                }}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Left panel - Request list */}
              <div className="w-1/2 border-r overflow-y-auto">
                <div className="p-4 border-b bg-gray-50">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-700">Demandes</h3>
                    <div className="flex items-center">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="text-sm border rounded-md px-2 py-1 bg-white"
                      >
                        <option value="all">Toutes</option>
                        <option value="pending">En attente</option>
                        <option value="active">En cours</option>
                        <option value="completed">Terminées</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="divide-y">
                  {loading ? (
                    <div className="p-8 text-center text-gray-500">
                      <div className="animate-spin h-8 w-8 border-2 border-[#f15922] border-t-transparent rounded-full mx-auto mb-4"></div>
                      <p>Chargement des demandes...</p>
                    </div>
                  ) : requests.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <HelpCircle size={48} className="mx-auto mb-4 text-gray-300" />
                      <p>Aucune demande d'assistance</p>
                    </div>
                  ) : (
                    requests.map((request) => (
                      <div
                        key={request.id}
                        className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                          selectedRequest?.id === request.id ? 'bg-gray-100' : ''
                        }`}
                        onClick={() => setSelectedRequest(request)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1 ${getStatusColor(request.status)}`}>
                                {getStatusIcon(request.status)}
                                {request.status === 'pending' ? 'En attente' :
                                 request.status === 'scheduled' ? 'Planifiée' :
                                 request.status === 'in_progress' ? 'En cours' :
                                 request.status === 'completed' ? 'Terminée' :
                                 'Annulée'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatDate(request.created_at)}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {request.user_email}
                            </p>
                            <p className="text-xs text-gray-600 line-clamp-2">
                              {request.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right panel - Request details */}
              <div className="w-1/2 overflow-y-auto">
                {selectedRequest ? (
                  <div className="p-6">
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900">Détails de la demande</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${getStatusColor(selectedRequest.status)}`}>
                          {getStatusIcon(selectedRequest.status)}
                          {selectedRequest.status === 'pending' ? 'En attente' :
                           selectedRequest.status === 'scheduled' ? 'Planifiée' :
                           selectedRequest.status === 'in_progress' ? 'En cours' :
                           selectedRequest.status === 'completed' ? 'Terminée' :
                           'Annulée'}
                        </span>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Demandeur</span>
                          <span className="text-sm text-gray-900">{selectedRequest.user_email}</span>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Date de demande</span>
                          <span className="text-sm text-gray-900">{formatDate(selectedRequest.created_at)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Disponibilité</span>
                          <span className="text-sm text-gray-900">{selectedRequest.availability}</span>
                        </div>
                      </div>

                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Message</h4>
                        <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-800">
                          {selectedRequest.message}
                        </div>
                      </div>

                      {selectedRequest.status === 'completed' ? (
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Heures utilisées</h4>
                            <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-800">
                              {selectedRequest.hours_spent || 'Non spécifié'}
                            </div>
                          </div>
                          
                          {selectedRequest.admin_notes && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-2">Notes</h4>
                              <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-800">
                                {selectedRequest.admin_notes}
                              </div>
                            </div>
                          )}
                          
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Résolu le</h4>
                            <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-800">
                              {selectedRequest.resolved_at ? formatDate(selectedRequest.resolved_at) : 'Non spécifié'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Heures utilisées
                            </label>
                            <input
                              type="number"
                              min="0.25"
                              step="0.25"
                              value={hoursSpent}
                              onChange={(e) => setHoursSpent(e.target.value)}
                              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                              placeholder="Ex: 1.5"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Notes (optionnel)
                            </label>
                            <textarea
                              value={adminNotes}
                              onChange={(e) => setAdminNotes(e.target.value)}
                              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent resize-none"
                              rows={3}
                              placeholder="Ajoutez des notes sur l'assistance fournie..."
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {selectedRequest.status !== 'completed' && selectedRequest.status !== 'cancelled' && (
                      <div className="flex flex-wrap gap-2">
                        {selectedRequest.status === 'pending' && (
                          <button
                            onClick={() => handleStatusChange(selectedRequest.id, 'scheduled')}
                            disabled={isUpdating}
                            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            <Calendar size={16} />
                            <span>Planifier</span>
                          </button>
                        )}
                        
                        {(selectedRequest.status === 'pending' || selectedRequest.status === 'scheduled') && (
                          <button
                            onClick={() => handleStatusChange(selectedRequest.id, 'in_progress')}
                            disabled={isUpdating}
                            className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            <MessageSquare size={16} />
                            <span>Démarrer</span>
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleStatusChange(selectedRequest.id, 'completed')}
                          disabled={isUpdating}
                          className="flex-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <CheckCircle size={16} />
                          <span>Terminer</span>
                        </button>
                        
                        <button
                          onClick={() => handleStatusChange(selectedRequest.id, 'cancelled')}
                          disabled={isUpdating}
                          className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <XCircle size={16} />
                          <span>Annuler</span>
                        </button>
                      </div>
                    )}

                    {error && (
                      <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-md flex items-center gap-2">
                        <AlertTriangle size={16} />
                        <span>{error}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-gray-500">
                    <HelpCircle size={48} className="text-gray-300 mb-4" />
                    <p className="text-center">
                      Sélectionnez une demande pour voir les détails
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}