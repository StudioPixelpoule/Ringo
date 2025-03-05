import React, { useEffect } from 'react';
import { X, Check, X as XIcon, UserCog, AlertCircle, UserPlus } from 'lucide-react';
import { useUserStore, Profile } from '../lib/store';
import { AddUserModal } from './AddUserModal';

export function UserManagementModal() {
  const {
    users,
    loading,
    error,
    selectedUser,
    isModalOpen,
    fetchUsers,
    updateUser,
    deleteUser,
    setSelectedUser,
    setModalOpen,
    setAddUserModalOpen,
    clearError,
  } = useUserStore();

  useEffect(() => {
    if (isModalOpen) {
      fetchUsers();
    } else {
      clearError();
    }
  }, [isModalOpen, fetchUsers, clearError]);

  const handleRoleChange = async (user: Profile, newRole: 'admin' | 'user') => {
    if (window.confirm(`Êtes-vous sûr de vouloir changer le rôle de ${user.email} en ${newRole} ?`)) {
      await updateUser(user.id, { role: newRole });
    }
  };

  const handleStatusChange = async (user: Profile) => {
    const newStatus = !user.status;
    const action = newStatus ? 'activer' : 'désactiver';
    if (window.confirm(`Êtes-vous sûr de vouloir ${action} l'utilisateur ${user.email} ?`)) {
      await updateUser(user.id, { status: newStatus });
    }
  };

  const handleDelete = async (user: Profile) => {
    if (window.confirm(`Êtes-vous sûr de vouloir désactiver définitivement l'utilisateur ${user.email} ?`)) {
      await deleteUser(user.id);
    }
  };

  if (!isModalOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 overflow-hidden">
          <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <UserCog size={24} />
              Gestion des Utilisateurs
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAddUserModalOpen(true)}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
                title="Ajouter un utilisateur"
              >
                <UserPlus size={20} />
              </button>
              <button
                onClick={() => setModalOpen(false)}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                <AlertCircle size={20} />
                <span>{error}</span>
                <button
                  onClick={clearError}
                  className="ml-auto text-red-700 hover:text-red-900"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-gray-600">Email</th>
                    <th className="text-left py-3 px-4 text-gray-600">Rôle</th>
                    <th className="text-left py-3 px-4 text-gray-600">Statut</th>
                    <th className="text-left py-3 px-4 text-gray-600">Date de création</th>
                    <th className="text-right py-3 px-4 text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-500">
                        Chargement...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-500">
                        Aucun utilisateur trouvé
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">{user.email}</td>
                        <td className="py-3 px-4">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user, e.target.value as 'admin' | 'user')}
                            className="bg-white border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                          >
                            <option value="user">Utilisateur</option>
                            <option value="admin">Administrateur</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleStatusChange(user)}
                            className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${
                              user.status
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {user.status ? <Check size={14} /> : <X size={14} />}
                            {user.status ? 'Actif' : 'Inactif'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {new Date(user.created_at).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDelete(user)}
                            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-full transition-colors"
                            title="Désactiver l'utilisateur"
                          >
                            <XIcon size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <AddUserModal />
    </>
  );
}