import React, { useState } from 'react';
import { X, UserPlus, Send } from 'lucide-react';
import { useUserStore } from '../lib/store';

export function AddUserModal() {
  const { 
    isAddUserModalOpen, 
    loading, 
    error, 
    inviteUser,
    setAddUserModalOpen, 
    clearError,
    userRole: currentUserRole 
  } = useUserStore();
  
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'user' | 'admin' | 'super_admin'>('user');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    await inviteUser({ email: email.trim(), role });
    if (!error) {
      setEmail('');
      setRole('user');
    }
  };

  const isSuperAdmin = currentUserRole === 'super_admin';

  if (!isAddUserModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <UserPlus size={24} />
            Inviter un Utilisateur
          </h2>
          <button
            onClick={() => {
              setAddUserModalOpen(false);
              clearError();
            }}
            className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
              required
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Rôle
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'user' | 'admin' | 'super_admin')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
            >
              <option value="user">Utilisateur</option>
              <option value="admin">Administrateur</option>
              {isSuperAdmin && (
                <option value="super_admin">S-Administrateur</option>
              )}
            </select>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => {
                setAddUserModalOpen(false);
                clearError();
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#f15922] text-white rounded-md hover:bg-[#f15922]/90 focus:outline-none focus:ring-2 focus:ring-[#f15922] disabled:opacity-50 flex items-center gap-2"
            >
              <Send size={18} />
              {loading ? 'Envoi...' : 'Envoyer l\'invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}