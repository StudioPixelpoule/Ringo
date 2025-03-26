import React, { useState } from 'react';
import { X, UserPlus, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { adminUtils } from '../lib/supabase';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateUserModal({ isOpen, onClose, onSuccess }: CreateUserModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin' | 'g_admin' | 'super_admin'>('user');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let newPassword = '';
    
    // Ensure at least one of each required character type
    newPassword += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
    newPassword += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
    newPassword += '0123456789'[Math.floor(Math.random() * 10)]; // Number
    newPassword += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special

    // Fill the rest randomly
    for (let i = newPassword.length; i < length; i++) {
      newPassword += charset[Math.floor(Math.random() * charset.length)];
    }

    // Shuffle the password
    newPassword = newPassword.split('')
      .sort(() => Math.random() - 0.5)
      .join('');

    setPassword(newPassword);
    setShowPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || loading) return;

    setLoading(true);
    setError(null);

    try {
      // First check if email already exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (existingUser) {
        throw new Error('Un utilisateur avec cet email existe déjà');
      }

      // Create the user using admin utils
      const { user } = await adminUtils.createUser(
        email.toLowerCase(),
        password,
        role
      );

      if (!user) throw new Error('Erreur lors de la création du compte');

      // Update the profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          role,
          status: true 
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Clear form
      setEmail('');
      setPassword('');
      setRole('user');
      setShowPassword(false);

      // Notify success
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating user:', error);
      setError(error instanceof Error ? error.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <UserPlus size={24} />
            Créer un Utilisateur
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
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
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
              placeholder="email@exemple.com"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-24 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                placeholder="••••••••"
                required
                disabled={loading}
                minLength={8}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={generatePassword}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                  title="Générer un mot de passe"
                >
                  <RefreshCw size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Minimum 8 caractères, avec majuscules, minuscules, chiffres et caractères spéciaux
            </p>
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Rôle
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
              disabled={loading}
            >
              <option value="user">Utilisateur</option>
              <option value="admin">Administrateur</option>
              <option value="g_admin">G-Administrateur</option>
              <option value="super_admin">Super Administrateur</option>
            </select>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="px-4 py-2 bg-[#f15922] text-white rounded-lg hover:bg-[#f15922]/90 focus:outline-none focus:ring-2 focus:ring-[#f15922] disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={18} />
                  <span>Création en cours...</span>
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  <span>Créer l'utilisateur</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}