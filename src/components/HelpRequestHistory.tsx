import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, Calendar, MessageSquare, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/errorLogger';

interface HelpRequest {
  id: string;
  message: string;
  availability: string;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  hours_spent: number | null;
  admin_notes: string | null;
}

export function HelpRequestHistory() {
  const [isOpen, setIsOpen] = useState(false);
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchRequests();
    }
  }, [isOpen]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Not authenticated');

      const { data, error: requestsError } = await supabase
        .from('help_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching help requests:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch requests');
      logError(error);
    } finally {
      setLoading(false);
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

  const toggleRequestExpansion = (id: string) => {
    setExpandedRequestId(expandedRequestId === id ? null : id);
  };

  return (
    <div className="w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-[#dba747]" />
          <span className="font-medium text-gray-700">Historique des demandes d'assistance</span>
        </div>
        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-4 pb-2 px-2">
              {loading ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="animate-spin h-8 w-8 border-2 border-[#f15922] border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p>Chargement de l'historique...</p>
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                  <AlertTriangle size={18} />
                  <span>{error}</span>
                </div>
              ) : requests.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Clock size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>Aucune demande d'assistance</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {requests.map((request) => (
                    <div
                      key={request.id}
                      className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm"
                    >
                      <div 
                        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => toggleRequestExpansion(request.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
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
                            <p className="text-sm text-gray-800 line-clamp-2">
                              {request.message}
                            </p>
                          </div>
                          <div className="ml-4">
                            {expandedRequestId === request.id ? (
                              <ChevronUp size={18} className="text-gray-400" />
                            ) : (
                              <ChevronDown size={18} className="text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {expandedRequestId === request.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-gray-200 bg-gray-50 px-4 py-3 space-y-3"
                          >
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">Disponibilité indiquée</p>
                              <p className="text-sm text-gray-800">{request.availability}</p>
                            </div>

                            {request.hours_spent !== null && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Heures utilisées</p>
                                <p className="text-sm text-gray-800">{request.hours_spent}</p>
                              </div>
                            )}

                            {request.admin_notes && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                                <p className="text-sm text-gray-800">{request.admin_notes}</p>
                              </div>
                            )}

                            {request.resolved_at && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Résolu le</p>
                                <p className="text-sm text-gray-800">{formatDate(request.resolved_at)}</p>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}