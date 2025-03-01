import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  X, 
  Search, 
  RefreshCw, 
  Plus, 
  Edit2, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Lock,
  LogOut,
  Mail,
  Unlock,
  CheckCircle,
  Info
} from 'lucide-react';
import { userService, User, UserSession } from '../lib/userService';
import { logger } from '../lib/logger';

interface UserManagementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const UserManagementPanel: React.FC<UserManagementPanelProps> = ({ 
  isOpen, 
  onClose,
  userId
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [userForm, setUserForm] = useState<{
    id?: string;
    email: string;
    first_name: string;
    last_name: string;
    role: 'admin' | 'user' | 'reader';
  }>({
    email: '',
    first_name: '',
    last_name: '',
    role: 'user'
  });
  const [newPassword, setNewPassword] = useState<string | null>(null);

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10
  });

  // Charger les utilisateurs
  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const allUsers = await userService.getAllUsers();
      setUsers(allUsers);

      // Log l'action
      logger.info('Liste des utilisateurs chargée', { count: allUsers.length }, 'UserManagement', userId);
    } catch (err) {
      console.error('Erreur lors du chargement des utilisateurs:', err);
      setError('Erreur lors du chargement des utilisateurs. Veuillez réessayer.');
      
      // Log l'erreur
      logger.error('Erreur lors du chargement des utilisateurs', { error: err }, 'UserManagement', userId);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Charger les utilisateurs au chargement
  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen, loadUsers]);

  // Charger les sessions d'un utilisateur
  const loadUserSessions = async (user: User) => {
    try {
      setIsLoadingSessions(true);
      setSelectedUser(user);

      const sessions = await userService.getUserSessions(user.id);
      setUserSessions(sessions);

      // Log l'action
      logger.info('Sessions utilisateur chargées', { userId: user.id, count: sessions.length }, 'UserManagement', userId);
    } catch (err) {
      console.error('Erreur lors du chargement des sessions:', err);
      
      // Log l'erreur
      logger.error('Erreur lors du chargement des sessions utilisateur', { targetUserId: user.id, error: err }, 'UserManagement', userId);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // Gérer le changement de page
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({
      ...prev,
      page: newPage
    }));
  };

  // Filtrer les utilisateurs
  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      (user.first_name && user.first_name.toLowerCase().includes(searchLower)) ||
      (user.last_name && user.last_name.toLowerCase().includes(searchLower)) ||
      user.role.toLowerCase().includes(searchLower)
    );
  });

  // Paginer les utilisateurs
  const paginatedUsers = filteredUsers.slice(
    (pagination.page - 1) * pagination.limit,
    pagination.page * pagination.limit
  );

  // Calculer le nombre total de pages
  const totalPages = Math.ceil(filteredUsers.length / pagination.limit);

  // Formater la date
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Créer un nouvel utilisateur
  const handleCreateUser = async () => {
    try {
      setActionInProgress('create');
      setError(null);

      // Valider les champs
      if (!userForm.email) {
        setError('L\'email est requis');
        setActionInProgress(null);
        return;
      }

      // Créer l'utilisateur
      const result = await userService.createUser({
        email: userForm.email,
        first_name: userForm.first_name,
        last_name: userForm.last_name,
        role: userForm.role
      });

      // Mettre à jour la liste des utilisateurs
      await loadUsers();

      // Afficher le mot de passe temporaire
      setNewPassword(result.temp_password);
      
      // Réinitialiser le formulaire
      setUserForm({
        email: '',
        first_name: '',
        last_name: '',
        role: 'user'
      });
      
      // Fermer le modal de création
      setIsCreatingUser(false);

      // Log l'action
      logger.info('Nouvel utilisateur créé', { email: userForm.email, role: userForm.role }, 'UserManagement', userId);
    } catch (err) {
      console.error('Erreur lors de la création de l\'utilisateur:', err);
      setError(`Erreur lors de la création de l'utilisateur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      
      // Log l'erreur
      logger.error('Erreur lors de la création de l\'utilisateur', { formData: userForm, error: err }, 'UserManagement', userId);
    } finally {
      setActionInProgress(null);
    }
  };

  // Mettre à jour un utilisateur
  const handleUpdateUser = async () => {
    try {
      setActionInProgress('update');
      setError(null);

      // Valider les champs
      if (!userForm.id) {
        setError('ID utilisateur manquant');
        setActionInProgress(null);
        return;
      }

      // Mettre à jour l'utilisateur
      await userService.updateUser({
        id: userForm.id,
        email: userForm.email,
        first_name: userForm.first_name,
        last_name: userForm.last_name,
        role: userForm.role
      });

      // Mettre à jour la liste des utilisateurs
      await loadUsers();
      
      // Fermer le modal d'édition
      setIsEditingUser(false);

      // Log l'action
      logger.info('Utilisateur mis à jour', { userId: userForm.id }, 'UserManagement', userId);
    } catch (err) {
      console.error('Erreur lors de la mise à jour de l\'utilisateur:', err);
      setError(`Erreur lors de la mise à jour de l'utilisateur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      
      // Log l'erreur
      logger.error('Erreur lors de la mise à jour de l\'utilisateur', { userId: userForm.id, error: err }, 'UserManagement', userId);
    } finally {
      setActionInProgress(null);
    }
  };

  // Désactiver un utilisateur
  const handleDisableUser = async (user: User) => {
    try {
      setActionInProgress(`disable-${user.id}`);
      setError(null);

      // Désactiver l'utilisateur
      await userService.disableUser(user.id);

      // Mettre à jour la liste des utilisateurs
      await loadUsers();

      // Log l'action
      logger.info('Utilisateur désactivé', { userId: user.id, email: user.email }, 'UserManagement', userId);
    } catch (err) {
      console.error('Erreur lors de la désactivation de l\'utilisateur:', err);
      setError(`Erreur lors de la désactivation de l'utilisateur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      
      // Log l'erreur
      logger.error('Erreur lors de la désactivation de l\'utilisateur', { userId: user.id, error: err }, 'UserManagement', userId);
    } finally {
      setActionInProgress(null);
    }
  };

  // Réactiver un utilisateur
  const handleEnableUser = async (user: User) => {
    try {
      setActionInProgress(`enable-${user.id}`);
      setError(null);

      // Réactiver l'utilisateur
      await userService.enableUser(user.id);

      // Mettre à jour la liste des utilisateurs
      await loadUsers();

      // Log l'action
      logger.info('Utilisateur réactivé', { userId: user.id, email: user.email }, 'UserManagement', userId);
    } catch (err) {
      console.error('Erreur lors de la réactivation de l\'utilisateur:', err);
      setError(`Erreur lors de la réactivation de l'utilisateur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      
      // Log l'erreur
      logger.error('Erreur lors de la réactivation de l\'utilisateur', { userId: user.id, error: err }, 'UserManagement', userId);
    } finally {
      setActionInProgress(null);
    }
  };

  // Supprimer un utilisateur
  const handleDeleteUser = async (user: User) => {
    try {
      // Demander confirmation
      if (confirmDelete !== user.id) {
        setConfirmDelete(user.id);
        setTimeout(() => setConfirmDelete(null), 3000); // Réinitialiser après 3 secondes
        return;
      }

      setActionInProgress(`delete-${user.id}`);
      setError(null);
      setConfirmDelete(null);

      // Supprimer l'utilisateur
      await userService.deleteUser(user.id);

      // Mettre à jour la liste des utilisateurs
      await loadUsers();

      // Si l'utilisateur supprimé était sélectionné, désélectionner
      if (selectedUser && selectedUser.id === user.id) {
        setSelectedUser(null);
      }

      // Log l'action
      logger.info('Utilisateur supprimé', { userId: user.id, email: user.email }, 'UserManagement', userId);
    } catch (err) {
      console.error('Erreur lors de la suppression de l\'utilisateur:', err);
      setError(`Erreur lors de la suppression de l'utilisateur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      
      // Log l'erreur
      logger.error('Erreur lors de la suppression de l\'utilisateur', { userId: user.id, error: err }, 'UserManagement', userId);
    } finally {
      setActionInProgress(null);
    }
  };

  // Réinitialiser le mot de passe d'un utilisateur
  const handleResetPassword = async (user: User) => {
    try {
      setActionInProgress(`reset-${user.id}`);
      setError(null);

      // Réinitialiser le mot de passe
      const newPass = await userService.resetUserPassword(user.id);

      // Afficher le nouveau mot de passe
      setNewPassword(newPass);

      // Log l'action
      logger.info('Mot de passe utilisateur réinitialisé', { userId: user.id, email: user.email }, 'UserManagement', userId);
    } catch (err) {
      console.error('Erreur lors de la réinitialisation du mot de passe:', err);
      setError(`Erreur lors de la réinitialisation du mot de passe: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      
      // Log l'erreur
      logger.error('Erreur lors de la réinitialisation du mot de passe', { userId: user.id, error: err }, 'UserManagement', userId);
    } finally {
      setActionInProgress(null);
    }
  };

  // Forcer la déconnexion d'un utilisateur
  const handleForceLogout = async (user: User) => {
    try {
      setActionInProgress(`logout-${user.id}`);
      setError(null);

      // Forcer la déconnexion
      await userService.forceLogout(user.id);

      // Si l'utilisateur est sélectionné, recharger ses sessions
      if (selectedUser && selectedUser.id === user.id) {
        await loadUserSessions(user);
      }

      // Log l'action
      logger.info('Déconnexion forcée de l\'utilisateur', { userId: user.id, email: user.email }, 'UserManagement', userId);
    } catch (err) {
      console.error('Erreur lors de la déconnexion forcée:', err);
      setError(`Erreur lors de la déconnexion forcée: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      
      // Log l'erreur
      logger.error('Erreur lors de la déconnexion forcée', { userId: user.id, error: err }, 'UserManagement', userId);
    } finally {
      setActionInProgress(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl w-[95vw] h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Users className="text-[#f15922]" size={24} />
            <h2 className="text-xl font-semibold text-[#2F4F4F]">Gestion des utilisateurs</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadUsers}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600"
              title="Rafraîchir"
            >
              <RefreshCw size={20} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search and Actions */}
        <div className="bg-gray-50 p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="relative w-64">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un utilisateur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#f15922]"
              />
            </div>
            <button
              onClick={() => {
                setIsCreatingUser(true);
                setIsEditingUser(false);
                setUserForm({
                  email: '',
                  first_name: '',
                  last_name: '',
                  role: 'user'
                });
                setNewPassword(null);
              }}
              className="px-4 py-2 bg-[#f15922] text-white rounded-lg hover:bg-[#d14811] transition-colors flex items-center gap-2"
            >
              <Plus size={16} />
              <span>Nouvel utilisateur</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
              <p className="font-medium">Erreur</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f15922]"></div>
                <p className="mt-4 text-gray-600">Chargement des utilisateurs...</p>
              </div>
            </div>
          ) : paginatedUsers.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="bg-gray-50 p-6 rounded-lg max-w-md text-center">
                <Users className="mx-auto text-gray-400 mb-3" size={32} />
                <p className="text-gray-700 font-medium">Aucun utilisateur trouvé</p>
                <p className="text-gray-500 mt-2">
                  {searchTerm ? 'Essayez de modifier votre recherche.' : 'Créez un nouvel utilisateur pour commencer.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Nom</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Rôle</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Statut</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Email confirmé</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Dernière connexion</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Dernière activité</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((user) => (
                    <tr 
                      key={user.id} 
                      className={`hover:bg-gray-50 cursor-pointer ${selectedUser?.id === user.id ? 'bg-blue-50' : ''}`}
                      onClick={() => loadUserSessions(user)}
                    >
                      <td className="px-4 py-3 border-b text-sm font-medium text-gray-800">
                        {user.email}
                      </td>
                      <td className="px-4 py-3 border-b text-sm text-gray-600">
                        {user.first_name} {user.last_name}
                      </td>
                      <td className="px-4 py-3 border-b">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : user.role === 'user'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role === 'admin' ? 'Admin' : user.role === 'user' ? 'Utilisateur' : 'Lecteur'}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-b">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.status === 'active' ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-b">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.email_confirmed
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {user.email_confirmed ? 'Oui' : 'Non'}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-b text-sm text-gray-600">
                        {formatDate(user.last_login)}
                      </td>
                      <td className="px-4 py-3 border-b text-sm text-gray-600">
                        {formatDate(user.last_activity)}
                      </td>
                      <td className="px-4 py-3 border-b">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setUserForm({
                                id: user.id,
                                email: user.email,
                                first_name: user.first_name || '',
                                last_name: user.last_name || '',
                                role: user.role
                              });
                              setIsEditingUser(true);
                              setIsCreatingUser(false);
                              setNewPassword(null);
                            }}
                            className="p-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            title="Modifier l'utilisateur"
                            disabled={actionInProgress !== null}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResetPassword(user);
                            }}
                            className="p-1.5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                            title="Réinitialiser le mot de passe"
                            disabled={actionInProgress !== null}
                          >
                            {actionInProgress === `reset-${user.id}` ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : (
                              <Lock size={16} />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleForceLogout(user);
                            }}
                            className="p-1.5 rounded-full bg-yellow-100 text-yellow-600 hover:bg-yellow-200 transition-colors"
                            title="Déconnecter l'utilisateur"
                            disabled={actionInProgress !== null}
                          >
                            {actionInProgress === `logout-${user.id}` ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : (
                              <LogOut size={16} />
                            )}
                          </button>
                          {!user.email_confirmed && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.alert(`Pour confirmer l'email de l'utilisateur, veuillez utiliser la fonction de réinitialisation du mot de passe.`);
                              }}
                              className="p-1.5 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                              title="Confirmer l'email"
                              disabled={actionInProgress !== null}
                            >
                              <Mail size={16} />
                            </button>
                          )}
                          {user.status === 'active' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDisableUser(user);
                              }}
                              className="p-1.5 rounded-full bg-orange-100 text-orange-600 hover:bg-orange-200 transition-colors"
                              title="Désactiver l'utilisateur"
                              disabled={actionInProgress !== null}
                            >
                              {actionInProgress === `disable-${user.id}` ? (
                                <RefreshCw size={16} className="animate-spin" />
                              ) : (
                                <Unlock size={16} />
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEnableUser(user);
                              }}
                              className="p-1.5 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                              title="Activer l'utilisateur"
                              disabled={actionInProgress !== null}
                            >
                              {actionInProgress === `enable-${user.id}` ? (
                                <RefreshCw size={16} className="animate-spin" />
                              ) : (
                                <CheckCircle size={16} />
                              )}
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteUser(user);
                            }}
                            className={`p-1.5 rounded-full ${
                              confirmDelete === user.id
                                ? 'bg-red-500 text-white hover:bg-red-600'
                                : 'bg-red-100 text-red-600 hover:bg-red-200'
                            } transition-colors`}
                            title={confirmDelete === user.id ? 'Confirmer la suppression' : 'Supprimer l\'utilisateur'}
                            disabled={actionInProgress !== null}
                          >
                            {actionInProgress === `delete-${user.id}` ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!isLoading && paginatedUsers.length > 0 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Affichage de {(pagination.page - 1) * pagination.limit + 1} à {Math.min(pagination.page * pagination.limit, filteredUsers.length)} sur {filteredUsers.length} utilisateurs
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
                Page {pagination.page} sur {totalPages || 1}
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

        {/* User Sessions */}
        {selectedUser && (
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-800">
                Sessions de {selectedUser.email}
              </h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 rounded-full hover:bg-gray-200 transition-colors text-gray-500"
              >
                <X size={16} />
              </button>
            </div>
            
            {isLoadingSessions ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#f15922]"></div>
                  <p className="mt-4 text-gray-600">Chargement des sessions...</p>
                </div>
              </div>
            ) : userSessions.length === 0 ? (
              <div className="bg-white p-6 rounded-lg text-center">
                <Info className="mx-auto text-gray-400 mb-3" size={24} />
                <p className="text-gray-700">Aucune session trouvée pour cet utilisateur</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Connexion</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Déconnexion</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Adresse IP</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">User Agent</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userSessions.map((session) => (
                      <tr key={session.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 border-b text-sm text-gray-600">
                          {formatDate(session.login_at)}
                        </td>
                        <td className="px-4 py-3 border-b text-sm text-gray-600">
                          {session.logout_at ? formatDate(session.logout_at) : '-'}
                        </td>
                        <td className="px-4 py-3 border-b text-sm text-gray-600">
                          {session.ip_address || '-'}
                        </td>
                        <td className="px-4 py-3 border-b text-sm text-gray-600">
                          {session.user_agent ? (
                            <div className="max-w-xs truncate" title={session.user_agent}>
                              {session.user_agent}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 border-b">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            session.logout_at
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {session.logout_at ? 'Terminée' : 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Create/Edit User Modal */}
        {(isCreatingUser || isEditingUser) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-800">
                  {isCreatingUser ? 'Nouvel utilisateur' : 'Modifier l\'utilisateur'}
                </h3>
                <button
                  onClick={() => {
                    setIsCreatingUser(false);
                    setIsEditingUser(false);
                  }}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
                >
                  <X size={16} />
                </button>
              </div>
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
                  <p className="font-medium">Erreur</p>
                  <p className="text-sm">{error}</p>
                </div>
              )}
              
              {newPassword && (
                <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 text-green-700 rounded">
                  <p className="font-medium">Mot de passe temporaire</p>
                  <p className="text-sm">Le mot de passe temporaire est: <span className="font-mono font-bold">{newPassword}</span></p>
                  <p className="text-xs mt-1">Veuillez communiquer ce mot de passe à l'utilisateur de manière sécurisée.</p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    id="edit-email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="edit-first_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Prénom
                  </label>
                  <input
                    type="text"
                    id="edit-first_name"
                    value={userForm.first_name}
                    onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="edit-last_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Nom
                  </label>
                  <input
                    type="text"
                    id="edit-last_name"
                    value={userForm.last_name}
                    onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="edit-role" className="block text-sm font-medium text-gray-700 mb-1">
                    Rôle
                  </label>
                  <select
                    id="edit-role"
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'admin' | 'user' | 'reader' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                  >
                    <option value="user">Utilisateur</option>
                    <option value="admin">Administrateur</option>
                    <option value="reader">Lecteur</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setIsCreatingUser(false);
                    setIsEditingUser(false);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={isCreatingUser ? handleCreateUser : handleUpdateUser}
                  className="px-4 py-2 bg-[#f15922] text-white rounded-lg hover:bg-[#d14811] transition-colors flex items-center gap-2"
                  disabled={actionInProgress !== null || (isCreatingUser && !userForm.email)}
                >
                  {actionInProgress ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : null}
                  <span>{isCreatingUser ? 'Créer' : 'Mettre à jour'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Password Reset Modal */}
        {newPassword && !isCreatingUser && !isEditingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-800">
                  Mot de passe réinitialisé
                </h3>
                <button
                  onClick={() => setNewPassword(null)}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
                >
                  <X size={16} />
                </button>
              </div>
              
              <div className="p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded mb-4">
                <p className="font-medium">Mot de passe temporaire généré</p>
                <p className="text-sm mt-2">Le mot de passe temporaire est:</p>
                <div className="bg-white p-3 rounded border border-green-200 font-mono text-lg font-bold text-center my-3">
                  {newPassword}
                </div>
                <p className="text-sm">Veuillez communiquer ce mot de passe à l'utilisateur de manière sécurisée.</p>
                <p className="text-xs mt-2">Note: Ce mot de passe ne sera plus affiché après la fermeture de cette fenêtre.</p>
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    // Copier le mot de passe dans le presse-papiers
                    navigator.clipboard.writeText(newPassword || '');
                    alert('Mot de passe copié dans le presse-papiers');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mr-2"
                >
                  Copier
                </button>
                <button
                  onClick={() => setNewPassword(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};