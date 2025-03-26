import React, { useEffect, useState } from 'react';
import { X, Check, UserCog, AlertCircle, UserPlus, Trash2, Users, Loader2 } from 'lucide-react';
import { useUserStore, Profile } from '../lib/store';

export function UserManagementModal() {
  const {
    users,
    loading,
    error,
    isModalOpen,
    userRole: currentUserRole,
    fetchUsers,
    updateUser,
    deleteUser,
    createUser,
    setModalOpen,
    clearError,
  } = useUserStore();

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin' | 'super_admin'>('user');
  const [roleFilter, setRoleFilter] = useState<'all' | 'super_admin' | 'admin' | 'user'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isModalOpen) {
      fetchUsers();
    } else {
      clearError();
    }
  }, [isModalOpen, fetchUsers, clearError]);

  const handleRoleChange = async (user: Profile, newRole: 'admin' | 'user' | 'super_admin') => {
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
    if (window.confirm(`⚠️ ATTENTION: Cette action est irréversible!\n\nÊtes-vous sûr de vouloir supprimer définitivement l'utilisateur ${user.email} ?\nToutes ses données seront perdues.`)) {
      await deleteUser(user.id);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPassword) return;

    try {
      await createUser({
        email: newUserEmail.trim(),
        password: newUserPassword,
        role: newUserRole
      });
      
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('user');
      setIsAddingUser(false);
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const isSuperAdmin = currentUserRole === 'super_admin';

  // Filter users based on current filters
  const filteredUsers = users.filter(user => {
    if (roleFilter !== 'all' && user.role !== roleFilter) return false;
    if (statusFilter !== 'all' && user.status !== (statusFilter === 'active')) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return user.email.toLowerCase().includes(query);
    }
    return true;
  });

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-xl">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <UserCog size={24} />
            Gestion des Utilisateurs
          </h2>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <button
                onClick={() => setIsAddingUser(true)}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
                title="Créer un utilisateur"
              >
                <UserPlus size={20} />
              </button>
            )}
            <button
              onClick={() => setModalOpen(false)}
              className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
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

          {/* Add User Form */}
          {isAddingUser && (
            <div className="bg-gray-50 border rounded-lg p-6 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Créer un Utilisateur</h3>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mot de passe
                    </label>
                    <input
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922]"
                      required
                      minLength={8}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rôle
                    </label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as typeof newUserRole)}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922]"
                    >
                      <option value="user">Utilisateur</option>
                      <option value="admin">Administrateur</option>
                      {isSuperAdmin && (
                        <option value="super_admin">Super Admin</option>
                      )}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddingUser(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#f15922] text-white rounded-md hover:bg-[#f15922]/90"
                  >
                    Créer l'utilisateur
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Filters */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rechercher
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par email..."
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rôle
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922]"
              >
                <option value="all">Tous les rôles</option>
                {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                <option value="admin">Admin</option>
                <option value="user">Utilisateur</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922]"
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
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
                    Date de création
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f15922] mx-auto mb-4"></div>
                      <p>Chargement...</p>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      Aucun utilisateur trouvé
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {user.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user, e.target.value as 'admin' | 'user' | 'super_admin')}
                          className={`bg-white border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15922] ${
                            !isSuperAdmin && user.role === 'super_admin'
                              ? 'opacity-50 cursor-not-allowed'
                              : ''
                          }`}
                          disabled={!isSuperAdmin && user.role === 'super_admin'}
                        >
                          <option value="user">Utilisateur</option>
                          <option value="admin">Administrateur</option>
                          {isSuperAdmin && (
                            <option value="super_admin">S-Administrateur</option>
                          )}
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleStatusChange(user)}
                          className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${
                            user.status
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                          disabled={!isSuperAdmin && user.role === 'super_admin'}
                        >
                          {user.status ? <Check size={14} /> : <X size={14} />}
                          {user.status ? 'Actif' : 'Inactif'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDelete(user)}
                            className={`text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center ${
                              !isSuperAdmin && user.role === 'super_admin'
                                ? 'opacity-50 cursor-not-allowed'
                                : ''
                            }`}
                            title="Supprimer définitivement"
                            disabled={!isSuperAdmin && user.role === 'super_admin'}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
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
  );
}