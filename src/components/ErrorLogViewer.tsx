import React, { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, Search, Filter, CheckCircle, Clock, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ErrorLog } from '../lib/errorLogger';
import { motion, AnimatePresence } from 'framer-motion';

interface ErrorLogViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ErrorLogViewer({ isOpen, onClose }: ErrorLogViewerProps) {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'investigating' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
      
      if (autoRefresh) {
        const interval = setInterval(fetchLogs, 30000); // Refresh every 30s
        return () => clearInterval(interval);
      }
    }
  }, [isOpen, autoRefresh, page, statusFilter]);

  const fetchLogs = async (reset = false) => {
    if (reset) {
      setPage(1);
      setLogs([]);
      setHasMore(true);
    }

    try {
      setLoading(true);
      const currentPage = reset ? 1 : page;
      
      let query = supabase
        .from('error_logs_with_users')
        .select('*')
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      setLogs(prev => reset ? data || [] : [...prev, ...(data || [])]);
      setHasMore((data?.length || 0) === PAGE_SIZE);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch error logs');
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = () => {
    if (!logsContainerRef.current || loading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    if (scrollHeight - scrollTop <= clientHeight * 1.5) {
      setPage(prev => prev + 1);
    }
  };

  const updateLogStatus = async (id: string, status: ErrorLog['status'], resolution?: string) => {
    try {
      const { error } = await supabase
        .from('error_logs')
        .update({ 
          status,
          ...(resolution ? { resolution } : {})
        })
        .eq('id', id);

      if (error) throw error;
      await fetchLogs(true);
    } catch (error) {
      console.error('Failed to update log status:', error);
    }
  };

  const toggleLogExpansion = (id: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredLogs = logs.filter(log => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.error.toLowerCase().includes(query) ||
        log.context?.toString().toLowerCase().includes(query) ||
        log.user_email?.toLowerCase().includes(query) ||
        log.stack?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-7xl mx-4 max-h-[85vh] flex flex-col"
      >
        <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-xl">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <AlertTriangle size={24} />
            Journal des Erreurs
          </h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`header-neumorphic-button px-3 py-1 rounded-full flex items-center gap-1 text-sm ${
                autoRefresh ? 'text-white' : 'text-white/70'
              }`}
              title={autoRefresh ? 'Désactiver le rafraîchissement auto' : 'Activer le rafraîchissement auto'}
            >
              <Clock size={16} />
              <span>Auto</span>
            </button>
            <button
              onClick={onClose}
              className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 flex-1 overflow-hidden">
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className={`
                relative transition-all duration-200
                ${isSearchFocused ? 'w-full' : 'w-96'}
              `}>
                <Search 
                  size={18} 
                  className={`
                    absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200
                    ${isSearchFocused ? 'text-[#f15922]' : 'text-gray-400'}
                  `}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  placeholder="Rechercher dans les erreurs..."
                  className={`
                    w-full pl-10 pr-4 py-2 border rounded-lg 
                    transition-all duration-200
                    ${isSearchFocused 
                      ? 'bg-white ring-2 ring-[#f15922] border-transparent' 
                      : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                    }
                  `}
                />
              </div>
            </div>
            <div className="w-48">
              <div className="relative">
                <Filter 
                  size={18} 
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" 
                />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as typeof statusFilter);
                    fetchLogs(true);
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg appearance-none hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="new">Nouveaux</option>
                  <option value="investigating">En cours</option>
                  <option value="resolved">Résolus</option>
                </select>
                <ChevronDown 
                  size={18} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" 
                />
              </div>
            </div>
          </div>

          {/* Error logs list */}
          <div 
            ref={logsContainerRef}
            onScroll={handleScroll}
            className="overflow-y-auto"
            style={{ height: 'calc(85vh - 220px)' }}
          >
            <div className="space-y-4">
              <AnimatePresence>
                {loading && page === 1 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f15922]"></div>
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Aucune erreur trouvée
                  </div>
                ) : (
                  filteredLogs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className={`
                        bg-white rounded-lg border shadow-sm overflow-hidden
                        ${log.status === 'new' ? 'border-red-200' :
                          log.status === 'investigating' ? 'border-yellow-200' :
                          'border-green-200'}
                      `}
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`
                                px-2 py-0.5 text-xs font-medium rounded-full
                                ${log.status === 'new' ? 'bg-red-100 text-red-800' :
                                  log.status === 'investigating' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'}
                              `}>
                                {log.status === 'new' ? 'Nouvelle' :
                                 log.status === 'investigating' ? 'En cours' :
                                 'Résolue'}
                              </span>
                              <span className="text-sm text-gray-500">
                                {new Date(log.created_at).toLocaleString('fr-FR')}
                              </span>
                              {log.user_email && (
                                <span className="text-sm text-gray-600">
                                  {log.user_email}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-900 font-medium">
                              {log.error}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleLogExpansion(log.id)}
                              className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                            >
                              {expandedLogs.has(log.id) ? (
                                <ChevronUp size={20} />
                              ) : (
                                <ChevronDown size={20} />
                              )}
                            </button>
                            {log.status === 'new' && (
                              <button
                                onClick={() => updateLogStatus(log.id, 'investigating')}
                                className="p-1 text-yellow-600 hover:text-yellow-700 rounded-full hover:bg-yellow-50"
                                title="Marquer comme en cours d'investigation"
                              >
                                <Activity size={20} />
                              </button>
                            )}
                            {log.status === 'investigating' && (
                              <button
                                onClick={() => {
                                  const resolution = window.prompt('Résolution de l\'erreur:');
                                  if (resolution) {
                                    updateLogStatus(log.id, 'resolved', resolution);
                                  }
                                }}
                                className="p-1 text-green-600 hover:text-green-700 rounded-full hover:bg-green-50"
                                title="Marquer comme résolue"
                              >
                                <CheckCircle size={20} />
                              </button>
                            )}
                          </div>
                        </div>

                        <AnimatePresence>
                          {expandedLogs.has(log.id) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="mt-4 space-y-4 overflow-hidden"
                            >
                              {log.stack && (
                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 mb-2">Stack Trace</h4>
                                  <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto">
                                    {log.stack}
                                  </pre>
                                </div>
                              )}
                              {log.context && (
                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 mb-2">Contexte</h4>
                                  <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto">
                                    {JSON.stringify(log.context, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.resolution && (
                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 mb-2">Résolution</h4>
                                  <p className="text-sm text-gray-600 bg-green-50 p-3 rounded-lg">
                                    {log.resolution}
                                  </p>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>

              {loading && page > 1 && (
                <div className="py-4 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#f15922]"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}