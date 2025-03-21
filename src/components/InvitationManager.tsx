import React, { useEffect } from 'react';
import { X, Send, Clock, CheckCircle, XCircle, AlertTriangle, Ban } from 'lucide-react';
import { useUserStore } from '../lib/store';

export function InvitationManager() {
  const { 
    invitations, 
    loading, 
    error, 
    fetchInvitations, 
    revokeInvitation,
    clearError 
  } = useUserStore();

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const handleRevoke = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir révoquer cette invitation ?')) {
      await revokeInvitation(id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      case 'revoked':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock size={14} />;
      case 'accepted':
        return <CheckCircle size={14} />;
      case 'expired':
        return <XCircle size={14} />;
      case 'revoked':
        return <Ban size={14} />;
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
    <div className="mt-8">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Invitations en cours
      </h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
          <AlertTriangle size={20} />
          <span>{error}</span>
          <button
            onClick={clearError}
            className="ml-auto text-red-700 hover:text-red-900"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f15922] mx-auto mb-4"></div>
          <p>Chargement des invitations...</p>
        </div>
      ) : invitations.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
          <Send size={32} className="mx-auto mb-2 text-gray-400" />
          <p>Aucune invitation en cours</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg overflow-hidden border">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rôle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date d'expiration
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invitations.map((invitation) => (
                <tr key={invitation.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {invitation.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {invitation.role === 'super_admin' ? 'S-Admin' :
                       invitation.role === 'admin' ? 'Admin' : 
                       'Utilisateur'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full items-center gap-1 ${getStatusColor(invitation.status)}`}>
                      {getStatusIcon(invitation.status)}
                      {invitation.status === 'pending' ? 'En attente' :
                       invitation.status === 'accepted' ? 'Acceptée' :
                       invitation.status === 'expired' ? 'Expirée' :
                       'Révoquée'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(invitation.expires_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {invitation.status === 'pending' && (
                      <button
                        onClick={() => handleRevoke(invitation.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Révoquer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}