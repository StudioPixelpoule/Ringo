import React, { useState, useEffect } from 'react';
import { Clock, Users, Search, Filter, Download, Calendar, Loader2, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/errorLogger';

interface UserHoursData {
  user_id: string;
  user_email: string;
  total_hours: number;
  hours_spent: number;
  hours_remaining: number;
  last_request_date: string | null;
  request_count: number;
}

export function HelpHoursAdminView() {
  const [isOpen, setIsOpen] = useState(false);
  const [usersData, setUsersData] = useState<UserHoursData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'user_email' | 'hours_remaining' | 'request_count'>('hours_remaining');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (isOpen) {
      fetchUsersHoursData();
    }
  }, [isOpen]);

  const fetchUsersHoursData = async () => {
    setLoading(true);
    try {
      // Get all users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('status', true)
        .order('email');

      if (profilesError) throw profilesError;
      if (!profiles) throw new Error('No profiles found');

      // Get help requests for all users
      const { data: requests, error: requestsError } = await supabase
        .from('help_requests')
        .select('user_id, hours_spent, status, created_at');

      if (requestsError) throw requestsError;

      // Process data
      const usersHoursData: UserHoursData[] = profiles.map(profile => {
        const userRequests = requests?.filter(req => req.user_id === profile.id) || [];
        const hoursSpent = userRequests.reduce((sum, req) => sum + (req.hours_spent || 0), 0);
        const totalHours = 40; // Default total hours
        const lastRequest = userRequests.length > 0 
          ? userRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
          : null;

        return {
          user_id: profile.id,
          user_email: profile.email,
          total_hours: totalHours,
          hours_spent: hoursSpent,
          hours_remaining: Math.max(0, totalHours - hoursSpent),
          last_request_date: lastRequest,
          request_count: userRequests.length
        };
      });

      setUsersData(usersHoursData);
    } catch (error) {
      console.error('Error fetching users hours data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch users data');
      logError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: 'user_email' | 'hours_remaining' | 'request_count') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedData = [...usersData]
    .filter(user => 
      user.user_email.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortField === 'user_email') {
        return sortDirection === 'asc'
          ? a.user_email.localeCompare(b.user_email)
          : b.user_email.localeCompare(a.user_email);
      } else if (sortField === 'hours_remaining') {
        return sortDirection === 'asc'
          ? a.hours_remaining - b.hours_remaining
          : b.hours_remaining - a.hours_remaining;
      } else {
        return sortDirection === 'asc'
          ? a.request_count - b.request_count
          : b.request_count - a.request_count;
      }
    });

  const formatDate = (date: string | null) => {
    if (!date) return 'Jamais';
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const exportToCSV = () => {
    // Create CSV content
    const headers = ['Email', 'Heures totales', 'Heures utilisées', 'Heures restantes', 'Nombre de demandes', 'Dernière demande'];
    const rows = sortedData.map(user => [
      user.user_email,
      user.total_hours.toString(),
      user.hours_spent.toString(),
      user.hours_remaining.toString(),
      user.request_count.toString(),
      formatDate(user.last_request_date)
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `heures-assistance-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
        title="Heures d'assistance"
      >
        <Clock size={18} strokeWidth={2.5} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-5xl mx-4 overflow-hidden flex flex-col"
        style={{ maxHeight: '85vh' }}
      >
        <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Clock size={24} />
            Suivi des Heures d'Assistance
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToCSV}
              className="header-neumorphic-button px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm text-white"
              title="Exporter en CSV"
            >
              <Download size={16} />
              <span>Exporter</span>
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par email..."
                  className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {sortedData.length} utilisateur{sortedData.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('user_email')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Utilisateur</span>
                      {sortField === 'user_email' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Heures totales
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Heures utilisées
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('hours_remaining')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Heures restantes</span>
                      {sortField === 'hours_remaining' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('request_count')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Demandes</span>
                      {sortField === 'request_count' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dernière demande
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Loader2 size={32} className="animate-spin mx-auto mb-4 text-[#f15922]" />
                      <p className="text-gray-500">Chargement des données...</p>
                    </td>
                  </tr>
                ) : sortedData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Users size={32} className="mx-auto mb-4 text-gray-300" />
                      <p className="text-gray-500">Aucun utilisateur trouvé</p>
                    </td>
                  </tr>
                ) : (
                  sortedData.map((user) => (
                    <tr key={user.user_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{user.user_email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{user.total_hours}h</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{user.hours_spent}h</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${
                          user.hours_remaining < 5 ? 'text-red-600' :
                          user.hours_remaining < 10 ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {user.hours_remaining}h
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{user.request_count}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{formatDate(user.last_request_date)}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  );
}