import React, { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, Search, Filter, CheckCircle, Clock, Activity, ChevronDown, ChevronUp, Copy, Zap, TrendingUp, Bug, Lightbulb, Code } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ErrorLog, ErrorLogWithUser } from '../lib/errorLogger';
import { motion, AnimatePresence } from 'framer-motion';

interface ErrorLogViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GroupedError {
  error: string;
  count: number;
  lastOccurrence: string;
  firstOccurrence: string;
  status: ErrorLog['status'];
  priority: 'critical' | 'high' | 'medium' | 'low';
  affectedUsers: Array<{ email: string; name?: string }>;
  logs: ErrorLogWithUser[];
  suggestedFix?: string;
  cursorPrompt?: string;
}

// Analyser l'erreur pour déterminer sa priorité
function getErrorPriority(error: string): 'critical' | 'high' | 'medium' | 'low' {
  const errorLower = error.toLowerCase();
  
  if (errorLower.includes('failed to fetch') || errorLower.includes('network') || errorLower.includes('cors')) {
    return 'critical';
  }
  if (errorLower.includes('auth') || errorLower.includes('jwt') || errorLower.includes('unauthorized')) {
    return 'critical';
  }
  if (errorLower.includes('database') || errorLower.includes('supabase') || errorLower.includes('sql')) {
    return 'high';
  }
  if (errorLower.includes('type') || errorLower.includes('undefined') || errorLower.includes('null')) {
    return 'medium';
  }
  return 'low';
}

// Générer un prompt Cursor basé sur l'erreur
function generateCursorPrompt(error: string, stack?: string, context?: any): string {
  const errorLower = error.toLowerCase();
  let prompt = `Fix this error in the Ringo application:\n\nError: ${error}\n`;

  if (stack) {
    // Extraire le fichier et la ligne de l'erreur
    const fileMatch = stack.match(/at\s+.*?\s+\((.*?):(\d+):(\d+)\)/);
    if (fileMatch) {
      prompt += `\nLocation: ${fileMatch[1]} at line ${fileMatch[2]}\n`;
    }
  }

  // Suggestions spécifiques selon le type d'erreur
  if (errorLower.includes('failed to fetch') || errorLower.includes('network')) {
    prompt += `\nThis is a network error. Check:
1. API endpoint URL configuration
2. CORS settings in Supabase
3. Network connectivity handling
4. Add proper error boundaries and retry logic`;
  } else if (errorLower.includes('jwt') || errorLower.includes('auth')) {
    prompt += `\nThis is an authentication error. Check:
1. Token refresh logic in supabase.ts
2. Session management in App.tsx
3. Auth state handling in protected routes
4. Add proper token expiry handling`;
  } else if (errorLower.includes('type') || errorLower.includes('undefined')) {
    prompt += `\nThis is a type error. Check:
1. TypeScript type definitions
2. Null/undefined checks before accessing properties
3. Optional chaining usage
4. Add proper type guards`;
  }

  if (context) {
    prompt += `\n\nContext: ${JSON.stringify(context, null, 2)}`;
  }

  return prompt;
}

// Analyser et suggérer une correction
function analyzeSolution(error: string): string {
  const errorLower = error.toLowerCase();

  if (errorLower.includes('failed to fetch')) {
    return "Vérifier la configuration réseau et les endpoints API. Implémenter une logique de retry avec exponential backoff.";
  }
  if (errorLower.includes('jwt expired')) {
    return "Implémenter un rafraîchissement automatique des tokens. Vérifier la logique dans supabase.ts.";
  }
  if (errorLower.includes('cannot read property')) {
    return "Ajouter des vérifications null/undefined. Utiliser l'optional chaining (?.) et le nullish coalescing (??).";
  }
  if (errorLower.includes('cors')) {
    return "Configurer les headers CORS dans Supabase. Vérifier les domaines autorisés.";
  }
  return "Analyser la stack trace et ajouter une gestion d'erreur appropriée.";
}

export function ErrorLogViewer({ isOpen, onClose }: ErrorLogViewerProps) {
  const [logs, setLogs] = useState<ErrorLogWithUser[]>([]);
  const [groupedErrors, setGroupedErrors] = useState<GroupedError[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'list'>('dashboard');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'investigating' | 'resolved'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
      const interval = setInterval(fetchLogs, 30000);
        return () => clearInterval(interval);
      }
  }, [isOpen]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('error_logs_with_users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500); // Récupérer plus pour l'analyse

      if (error) throw error;
      
      setLogs(data || []);
      groupErrors(data || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch error logs');
    } finally {
      setLoading(false);
    }
  };

  const groupErrors = (logs: ErrorLogWithUser[]) => {
    const groups = new Map<string, GroupedError>();

    logs.forEach(log => {
      const key = log.error;
      if (!groups.has(key)) {
        groups.set(key, {
          error: log.error,
          count: 0,
          lastOccurrence: log.created_at,
          firstOccurrence: log.created_at,
          status: log.status,
          priority: getErrorPriority(log.error),
          affectedUsers: [],
          logs: [],
          suggestedFix: analyzeSolution(log.error),
          cursorPrompt: generateCursorPrompt(log.error, log.stack, log.context)
        });
      }

      const group = groups.get(key)!;
      group.count++;
      group.logs.push(log);
      
      if (new Date(log.created_at) > new Date(group.lastOccurrence)) {
        group.lastOccurrence = log.created_at;
        group.status = log.status;
      }
      if (new Date(log.created_at) < new Date(group.firstOccurrence)) {
        group.firstOccurrence = log.created_at;
      }
      
      if (log.user_email && !group.affectedUsers.some(u => u.email === log.user_email)) {
        group.affectedUsers.push({ 
          email: log.user_email, 
          name: log.user_name 
        });
      }
    });

    const grouped = Array.from(groups.values())
      .sort((a, b) => {
        // Trier par priorité puis par nombre d'occurrences
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return b.count - a.count;
      });

    setGroupedErrors(grouped);
  };

  const copyPrompt = (prompt: string, errorId: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(errorId);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  const updateErrorStatus = async (error: string, status: ErrorLog['status']) => {
    try {
      const affectedLogs = groupedErrors.find(g => g.error === error)?.logs || [];
      
      await Promise.all(
        affectedLogs.map(log =>
          supabase
        .from('error_logs')
            .update({ status })
            .eq('id', log.id)
        )
      );

      await fetchLogs();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const toggleErrorExpansion = (error: string) => {
    setExpandedErrors(prev => {
      const next = new Set(prev);
      if (next.has(error)) {
        next.delete(error);
      } else {
        next.add(error);
      }
      return next;
    });
  };

  const filteredErrors = groupedErrors.filter(group => {
    if (statusFilter !== 'all' && group.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && group.priority !== priorityFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        group.error.toLowerCase().includes(query) ||
        group.affectedUsers.some(u => 
          u.email.toLowerCase().includes(query) ||
          (u.name && u.name.toLowerCase().includes(query))
        )
      );
    }
    return true;
  });

  // Statistiques pour le dashboard
  const stats = {
    total: groupedErrors.length,
    critical: groupedErrors.filter(e => e.priority === 'critical').length,
    new: groupedErrors.filter(e => e.status === 'new').length,
    resolved: groupedErrors.filter(e => e.status === 'resolved').length,
    totalOccurrences: groupedErrors.reduce((sum, e) => sum + e.count, 0),
    affectedUsers: new Set(groupedErrors.flatMap(e => e.affectedUsers.map(u => u.email))).size
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return <Zap className="text-red-500" size={16} />;
      case 'high': return <AlertTriangle className="text-orange-500" size={16} />;
      case 'medium': return <Bug className="text-yellow-500" size={16} />;
      default: return <Activity className="text-blue-500" size={16} />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-blue-100 text-blue-800 border-blue-200'
    };
    
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${colors[priority as keyof typeof colors]}`}>
        {priority.toUpperCase()}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-7xl mx-4 max-h-[90vh] flex flex-col"
      >
        <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-xl">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Code size={24} />
            Assistant de Débogage
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex bg-white/20 rounded-lg p-0.5">
              <button
                onClick={() => setView('dashboard')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  view === 'dashboard' ? 'bg-white text-[#f15922]' : 'text-white'
                }`}
              >
                Dashboard
              </button>
            <button
                onClick={() => setView('list')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  view === 'list' ? 'bg-white text-[#f15922]' : 'text-white'
              }`}
              >
                Détails
            </button>
            </div>
            <button
              onClick={onClose}
              className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {view === 'dashboard' ? (
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Stats Overview */}
              <div className="grid grid-cols-6 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="text-sm text-gray-600">Total Erreurs</div>
                  <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <div className="text-sm text-red-600">Critiques</div>
                  <div className="text-2xl font-bold text-red-700">{stats.critical}</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <div className="text-sm text-yellow-600">Nouvelles</div>
                  <div className="text-2xl font-bold text-yellow-700">{stats.new}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="text-sm text-green-600">Résolues</div>
                  <div className="text-2xl font-bold text-green-700">{stats.resolved}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="text-sm text-blue-600">Occurrences</div>
                  <div className="text-2xl font-bold text-blue-700">{stats.totalOccurrences}</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <div className="text-sm text-purple-600">Utilisateurs</div>
                  <div className="text-2xl font-bold text-purple-700">{stats.affectedUsers}</div>
                </div>
              </div>

              {/* Erreurs prioritaires */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Zap className="text-[#f15922]" size={20} />
                  Erreurs à traiter en priorité
                  <span className="text-sm font-normal text-gray-500">
                    (Top 10 sur {filteredErrors.length} erreurs)
                  </span>
                </h3>
                <div className="space-y-4">
                  {filteredErrors.slice(0, 10).map((group) => (
                    <motion.div
                      key={group.error}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-lg border shadow-sm overflow-hidden"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              {getPriorityIcon(group.priority)}
                              {getPriorityBadge(group.priority)}
                              <span className="text-sm text-gray-600">
                                {group.count} occurrence{group.count > 1 ? 's' : ''}
                              </span>
                              <span className="text-sm text-gray-500">
                                {group.affectedUsers.length} utilisateur{group.affectedUsers.length > 1 ? 's' : ''}
                              </span>
                            </div>
                            <p className="font-medium text-gray-900 mb-2">{group.error}</p>
                            
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                              <div className="flex items-start gap-2">
                                <Lightbulb className="text-blue-600 mt-0.5" size={16} />
            <div className="flex-1">
                                  <p className="text-sm text-blue-900 font-medium mb-1">Solution suggérée :</p>
                                  <p className="text-sm text-blue-700">{group.suggestedFix}</p>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => copyPrompt(group.cursorPrompt!, group.error)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-[#f15922] text-white rounded-lg hover:bg-[#f15922]/90 transition-colors text-sm font-medium"
                              >
                                <Copy size={16} />
                                {copiedPrompt === group.error ? 'Copié !' : 'Copier prompt Cursor'}
                              </button>
                              <button
                                onClick={() => updateErrorStatus(group.error, 'investigating')}
                                className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-sm font-medium"
                              >
                                Je m'en occupe
                              </button>
                              <button
                                onClick={() => toggleErrorExpansion(group.error)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                              >
                                {expandedErrors.has(group.error) ? (
                                  <ChevronUp size={18} />
                                ) : (
                                  <ChevronDown size={18} />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        <AnimatePresence>
                          {expandedErrors.has(group.error) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="mt-4 space-y-3"
                            >
                              <div className="bg-gray-50 rounded-lg p-3">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Prompt Cursor complet :</h4>
                                <pre className="text-xs bg-white p-3 rounded border overflow-x-auto whitespace-pre-wrap">
                                  {group.cursorPrompt}
                                </pre>
                              </div>
                              {group.logs[0].stack && (
                                <div className="bg-gray-50 rounded-lg p-3">
                                  <h4 className="text-sm font-medium text-gray-700 mb-2">Stack Trace :</h4>
                                  <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
                                    {group.logs[0].stack}
                                  </pre>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ))}
                </div>
                
                {filteredErrors.length > 10 && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={() => setView('list')}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                    >
                      Voir toutes les {filteredErrors.length} erreurs
                      <ChevronDown size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Filtres */}
              <div className="flex gap-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  className="flex-1 px-4 py-2 border rounded-lg"
                />
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as any)}
                  className="px-4 py-2 border rounded-lg"
                >
                  <option value="all">Toutes priorités</option>
                  <option value="critical">Critique</option>
                  <option value="high">Haute</option>
                  <option value="medium">Moyenne</option>
                  <option value="low">Basse</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-4 py-2 border rounded-lg"
                >
                  <option value="all">Tous statuts</option>
                  <option value="new">Nouvelles</option>
                  <option value="investigating">En cours</option>
                  <option value="resolved">Résolues</option>
                </select>
          </div>

              {/* Liste détaillée */}
              {filteredErrors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Activity size={48} className="mb-4 text-gray-300" />
                  <p className="text-lg font-medium">Aucune erreur trouvée</p>
                  <p className="text-sm mt-2">Modifiez vos filtres pour voir plus de résultats</p>
                  </div>
                ) : (
                <div className="space-y-4">
                  {filteredErrors.map((group) => (
                    <motion.div
                      key={group.error}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-lg border shadow-sm overflow-hidden"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              {getPriorityIcon(group.priority)}
                              {getPriorityBadge(group.priority)}
                              <span className="text-sm text-gray-600">
                                {group.count} occurrence{group.count > 1 ? 's' : ''}
                              </span>
                              <span className="text-sm text-gray-500">
                                {group.affectedUsers.length} utilisateur{group.affectedUsers.length > 1 ? 's' : ''}
                              </span>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                group.status === 'new' ? 'bg-red-100 text-red-800' :
                                group.status === 'investigating' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {group.status === 'new' ? 'Nouvelle' :
                                 group.status === 'investigating' ? 'En cours' :
                                 'Résolue'}
                                </span>
                            </div>
                            <p className="font-medium text-gray-900 mb-2">{group.error}</p>
                            
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                              <div className="flex items-start gap-2">
                                <Lightbulb className="text-blue-600 mt-0.5" size={16} />
                                <div className="flex-1">
                                  <p className="text-sm text-blue-900 font-medium mb-1">Solution suggérée :</p>
                                  <p className="text-sm text-blue-700">{group.suggestedFix}</p>
                                </div>
                              </div>
                            </div>

                            <div className="text-xs text-gray-500 mb-2">
                              Première occurrence : {new Date(group.firstOccurrence).toLocaleString('fr-FR')}
                              {' • '}
                              Dernière occurrence : {new Date(group.lastOccurrence).toLocaleString('fr-FR')}
                          </div>

                          <div className="flex items-center gap-2">
                              <button
                                onClick={() => copyPrompt(group.cursorPrompt!, group.error)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-[#f15922] text-white rounded-lg hover:bg-[#f15922]/90 transition-colors text-sm font-medium"
                              >
                                <Copy size={16} />
                                {copiedPrompt === group.error ? 'Copié !' : 'Copier prompt Cursor'}
                              </button>
                              {group.status === 'new' && (
                                <button
                                  onClick={() => updateErrorStatus(group.error, 'investigating')}
                                  className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-sm font-medium"
                                  title="Marquer cette erreur comme étant en cours d'investigation"
                              >
                                  Je m'en occupe
                                </button>
                              )}
                              {group.status === 'investigating' && (
                                <button
                                  onClick={() => updateErrorStatus(group.error, 'resolved')}
                                  className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                                  title="Marquer cette erreur comme résolue"
                                >
                                  Marquer résolue
                                </button>
                              )}
                              {group.status === 'resolved' && (
                                <button
                                  onClick={() => updateErrorStatus(group.error, 'new')}
                                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                                  title="Rouvrir cette erreur"
                                >
                                  Rouvrir
                              </button>
                            )}
                              <button
                                onClick={() => toggleErrorExpansion(group.error)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                              >
                                {expandedErrors.has(group.error) ? (
                                  <ChevronUp size={18} />
                                ) : (
                                  <ChevronDown size={18} />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        <AnimatePresence>
                          {expandedErrors.has(group.error) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="mt-4 space-y-3"
                            >
                              <div className="bg-gray-50 rounded-lg p-3">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Prompt Cursor complet :</h4>
                                <pre className="text-xs bg-white p-3 rounded border overflow-x-auto whitespace-pre-wrap">
                                  {group.cursorPrompt}
                                  </pre>
                                </div>
                              {group.logs[0].stack && (
                                <div className="bg-gray-50 rounded-lg p-3">
                                  <h4 className="text-sm font-medium text-gray-700 mb-2">Stack Trace :</h4>
                                  <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
                                    {group.logs[0].stack}
                                  </pre>
                                </div>
                              )}
                              <div className="bg-gray-50 rounded-lg p-3">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Utilisateurs affectés :</h4>
                                <div className="flex flex-wrap gap-2">
                                  {group.affectedUsers.map((user, index) => (
                                    <span key={index} className="px-2 py-1 bg-white rounded border text-xs">
                                      {user.name ? (
                                        <span>
                                          <span className="font-medium">{user.name}</span>
                                          <span className="text-gray-500 ml-1">({user.email})</span>
                                        </span>
                                      ) : (
                                        user.email
                                      )}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}