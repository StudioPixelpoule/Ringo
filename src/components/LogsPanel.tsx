import React, { useState, useEffect, useCallback } from 'react';
import { 
  Download, 
  RefreshCw, 
  Search, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  Calendar,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { logger, LogEntry, LogLevel } from '../lib/logger';

interface LogsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const LogsPanel: React.FC<LogsPanelProps> = ({ 
  isOpen, 
  onClose,
  userId
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalLogs, setTotalLogs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(10000); // 10 secondes par défaut
  const [refreshTimer, setRefreshTimer] = useState<NodeJS.Timeout | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  // Filtres
  const [filters, setFilters] = useState({
    level: '' as LogLevel | '',
    startDate: '',
    endDate: '',
    source: '',
    searchTerm: ''
  });

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50
  });

  // Charger les logs
  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Préparer les options de filtrage
      const options: any = {
        limit: pagination.limit,
        offset: (pagination.page - 1) * pagination.limit
      };

      if (filters.level) {
        options.level = filters.level;
      }

      if (filters.startDate) {
        options.startDate = new Date(filters.startDate);
      }

      if (filters.endDate) {
        // Ajouter un jour pour inclure toute la journée
        const endDate = new Date(filters.endDate);
        endDate.setDate(endDate.getDate() + 1);
        options.endDate = endDate;
      }

      if (filters.source) {
        options.source = filters.source;
      }

      // Récupérer les logs
      const { logs, count } = await logger.getLogs(options);

      // Filtrer par terme de recherche si nécessaire
      let filteredLogs = logs;
      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase();
        filteredLogs = logs.filter(log => 
          log.message.toLowerCase().includes(searchTerm) || 
          (log.source && log.source.toLowerCase().includes(searchTerm)) ||
          (log.details && JSON.stringify(log.details).toLowerCase().includes(searchTerm))
        );
      }

      setLogs(filteredLogs);
      setTotalLogs(count);
    } catch (err) {
      console.error('Erreur lors du chargement des logs:', err);
      setError('Erreur lors du chargement des logs. Veuillez réessayer.');
      
      // Enregistrer l'erreur dans les logs
      logger.error('Erreur lors du chargement des logs', err, 'LogsPanel', userId);
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination, userId]);

  // Charger les logs au chargement et configurer l'intervalle de rafraîchissement
  useEffect(() => {
    if (isOpen) {
      loadLogs();

      // Configurer l'intervalle de rafraîchissement
      if (refreshInterval) {
        const timer = setInterval(() => {
          loadLogs();
        }, refreshInterval);
        
        setRefreshTimer(timer);
        
        return () => {
          clearInterval(timer);
          setRefreshTimer(null);
        };
      }
    }
  }, [isOpen, refreshInterval, loadLogs]);

  // Nettoyer l'intervalle à la fermeture
  useEffect(() => {
    return () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    };
  }, [refreshTimer]);

  // Gérer le changement de page
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({
      ...prev,
      page: newPage
    }));
  };

  // Gérer le changement de filtre
  const handleFilterChange = (name: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Réinitialiser la pagination
    setPagination(prev => ({
      ...prev,
      page: 1
    }));
  };

  // Réinitialiser les filtres
  const handleResetFilters = () => {
    setFilters({
      level: '',
      startDate: '',
      endDate: '',
      source: '',
      searchTerm: ''
    });
    
    // Réinitialiser la pagination
    setPagination({
      page: 1,
      limit: 50
    });
  };

  // Exporter les logs au format CSV
  const handleExportLogs = async () => {
    try {
      setIsExporting(true);
      
      // Préparer les options de filtrage
      const options: any = {};

      if (filters.level) {
        options.level = filters.level;
      }

      if (filters.startDate) {
        options.startDate = new Date(filters.startDate);
      }

      if (filters.endDate) {
        // Ajouter un jour pour inclure toute la journée
        const endDate = new Date(filters.endDate);
        endDate.setDate(endDate.getDate() + 1);
        options.endDate = endDate;
      }

      if (filters.source) {
        options.source = filters.source;
      }
      
      // Exporter les logs
      const csv = await logger.exportLogsAsCsv(options);
      
      // Créer un blob et un lien de téléchargement
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `logs_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Enregistrer l'action dans les logs
      logger.info('Logs exportés au format CSV', { filters }, 'LogsPanel', userId);
    } catch (err) {
      console.error('Erreur lors de l\'exportation des logs:', err);
      setError('Erreur lors de l\'exportation des logs. Veuillez réessayer.');
      
      // Enregistrer l'erreur dans les logs
      logger.error('Erreur lors de l\'exportation des logs', err, 'LogsPanel', userId);
    } finally {
      setIsExporting(false);
    }
  };

  // Nettoyer les logs anciens
  const handleCleanupLogs = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer les logs de plus de 30 jours ? Cette action est irréversible.')) {
      return;
    }
    
    try {
      setIsCleaning(true);
      
      // Nettoyer les logs
      await logger.cleanupOldLogs();
      
      // Recharger les logs
      await loadLogs();
      
      // Enregistrer l'action dans les logs
      logger.info('Nettoyage des logs anciens effectué', null, 'LogsPanel', userId);
    } catch (err) {
      console.error('Erreur lors du nettoyage des logs:', err);
      setError('Erreur lors du nettoyage des logs. Veuillez réessayer.');
      
      // Enregistrer l'erreur dans les logs
      logger.error('Erreur lors du nettoyage des logs', err, 'LogsPanel', userId);
    } finally {
      setIsCleaning(false);
    }
  };

  // Gérer le rafraîchissement automatique
  const toggleAutoRefresh = () => {
    if (refreshInterval) {
      // Désactiver le rafraîchissement automatique
      if (refreshTimer) {
        clearInterval(refreshTimer);
        setRefreshTimer(null);
      }
      setRefreshInterval(null);
    } else {
      // Activer le rafraîchissement automatique
      setRefreshInterval(10000);
    }
  };

  // Formater la date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Obtenir la couleur en fonction du niveau de log
  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'info':
        return 'bg-blue-100 text-blue-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Obtenir l'icône en fonction du niveau de log
  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'info':
        return <Info size={16} className="text-blue-500" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-yellow-500" />;
      case 'error':
        return <AlertCircle size={16} className="text-red-500" />;
      default:
        return null;
    }
  };

  // Calculer le nombre total de pages
  const totalPages = Math.ceil(totalLogs / pagination.limit);

  // Extraire les sources uniques pour le filtre
  const uniqueSources = Array.from(new Set(logs.map(log => log.source).filter(Boolean)));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl w-[95vw] h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-[#f15922]" size={24} />
            <h2 className="text-xl font-semibold text-[#2F4F4F]">Logs & Erreurs</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadLogs}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600"
              title="Rafraîchir"
            >
              <RefreshCw size={20} />
            </button>
            <button
              onClick={toggleAutoRefresh}
              className={`p-2 rounded-full transition-colors ${
                refreshInterval ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={refreshInterval ? "Désactiver le rafraîchissement automatique" : "Activer le rafraîchissement automatique"}
            >
              {refreshInterval ? (
                <span className="flex items-center gap-1">
                  <span className="text-xs font-medium">Auto</span>
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                </span>
              ) : (
                <span className="text-xs font-medium">Auto</span>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-50 p-4 border-b border-gray-100">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Niveau */}
            <div className="flex items-center gap-2">
              <label htmlFor="level-filter" className="text-sm font-medium text-gray-600">Niveau:</label>
              <select
                id="level-filter"
                value={filters.level}
                onChange={(e) => handleFilterChange('level', e.target.value)}
                className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#f15922]"
              >
                <option value="">Tous</option>
                <option value="info">Info</option>
                <option value="warning">Avertissement</option>
                <option value="error">Erreur</option>
              </select>
            </div>

            {/* Date de début */}
            <div className="flex items-center gap-2">
              <label htmlFor="start-date-filter" className="text-sm font-medium text-gray-600">Du:</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  id="start-date-filter"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="pl-10 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#f15922]"
                />
              </div>
            </div>

            {/* Date de fin */}
            <div className="flex items-center gap-2">
              <label htmlFor="end-date-filter" className="text-sm font-medium text-gray-600">Au:</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  id="end-date-filter"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="pl-10 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#f15922]"
                />
              </div>
            </div>

            {/* Source */}
            <div className="flex items-center gap-2">
              <label htmlFor="source-filter" className="text-sm font-medium text-gray-600">Source:</label>
              <select
                id="source-filter"
                value={filters.source}
                onChange={(e) => handleFilterChange('source', e.target.value)}
                className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#f15922]"
              >
                <option value="">Toutes</option>
                {uniqueSources.map((source) => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </div>

            {/* Recherche */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher dans les logs..."
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#f15922]"
                />
                {filters.searchTerm && (
                  <button
                    onClick={() => handleFilterChange('searchTerm', '')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Réinitialiser les filtres */}
            <button
              onClick={handleResetFilters}
              className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm flex items-center gap-1"
            >
              <Filter size={16} />
              <span>Réinitialiser</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f15922]"></div>
                <p className="mt-4 text-gray-600">Chargement des logs...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="bg-red-50 p-6 rounded-lg max-w-md text-center">
                <AlertCircle className="mx-auto text-red-500 mb-3" size={32} />
                <p className="text-red-700 font-medium">{error}</p>
                <button
                  onClick={loadLogs}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Réessayer
                </button>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="bg-gray-50 p-6 rounded-lg max-w-md text-center">
                <Info className="mx-auto text-gray-400 mb-3" size={32} />
                <p className="text-gray-700 font-medium">Aucun log trouvé</p>
                <p className="text-gray-500 mt-2">
                  Essayez de modifier vos filtres ou de rafraîchir la page.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Horodatage</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Niveau</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Source</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Message</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Détails</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 border-b text-sm text-gray-600">
                        {log.timestamp ? formatDate(log.timestamp) : ''}
                      </td>
                      <td className="px-4 py-3 border-b">
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLevelColor(log.level)}`}>
                          {getLevelIcon(log.level)}
                          <span className="ml-1 capitalize">{log.level}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-b text-sm text-gray-600">
                        {log.source || '-'}
                      </td>
                      <td className="px-4 py-3 border-b text-sm text-gray-800">
                        {log.message}
                      </td>
                      <td className="px-4 py-3 border-b text-sm text-gray-600">
                        {log.details ? (
                          <details className="cursor-pointer">
                            <summary className="text-blue-600 hover:text-blue-800">Voir détails</summary>
                            <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-32">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!isLoading && logs.length > 0 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Affichage de {(pagination.page - 1) * pagination.limit + 1} à {Math.min(pagination.page * pagination.limit, totalLogs)} sur {totalLogs} logs
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className={`p-2 rounded-lg transition-colors ${
                  pagination.page === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-gray-600">
                Page {pagination.page} sur {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= totalPages}
                className={`p-2 rounded-lg transition-colors ${
                  pagination.page >= totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {totalLogs} log{totalLogs !== 1 ? 's' : ''} au total
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleCleanupLogs}
                disabled={isCleaning}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                {isCleaning ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                <span>Nettoyer les logs anciens</span>
              </button>
              <button
                onClick={handleExportLogs}
                disabled={isExporting || logs.length === 0}
                className="px-4 py-2 bg-[#f15922] text-white rounded-lg hover:bg-[#d14811] transition-colors flex items-center gap-2"
              >
                {isExporting ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                <span>Exporter en CSV</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};