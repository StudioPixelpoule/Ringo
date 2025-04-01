import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { SmallLogo } from '../components/SmallLogo';
import { IrsstLogo } from '../components/IrsstLogo';
import { Loader2 } from 'lucide-react';
import { logError } from '../lib/errorLogger';

export function ChangePassword() {
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // Force redirect after successful password change
  useEffect(() => {
    if (success && !redirecting) {
      const timer = setTimeout(() => {
        setRedirecting(true);
        window.location.href = '/'; // Force hard redirect to ensure state is reset
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [success, redirecting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      // Mark password as changed
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ password_changed: true })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Set success state
      setSuccess(true);
      
      // Redirect will happen via useEffect
    } catch (error) {
      console.error('Error changing password:', error);
      logError(error);
      setError(error instanceof Error ? error.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f15922] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 flex items-center justify-center">
            <Logo />
          </div>
          <h1 className="text-white text-4xl font-bold flex items-center">
            RINGO
            <sup className="ml-1 flex items-center gap-0.5 text-sm text-white">
              <span>par</span>
              <SmallLogo />
            </sup>
          </h1>
          <div className="mt-4">
            <IrsstLogo />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 shadow-xl">
          <h2 className="text-xl font-medium text-white mb-6">
            Changement de mot de passe
          </h2>

          {success ? (
            <div className="bg-green-500/20 border border-green-500/50 text-white px-4 py-3 rounded-md text-center">
              <p className="mb-2">Mot de passe mis à jour avec succès !</p>
              <p className="text-sm">
                {redirecting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Redirection en cours...
                  </span>
                ) : (
                  "Redirection vers l'accueil..."
                )}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="password" className="block text-white text-sm font-medium mb-2">
                  Nouveau mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-md bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-white text-sm font-medium mb-2">
                  Confirmer le mot de passe
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-md bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-white px-4 py-3 rounded-md">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2F4F4F] text-white py-3 px-4 rounded-md hover:bg-[#2F4F4F]/90 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Mise à jour...</span>
                  </>
                ) : (
                  'Mettre à jour le mot de passe'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}