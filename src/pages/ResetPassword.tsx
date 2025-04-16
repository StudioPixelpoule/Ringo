import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { SmallLogo } from '../components/SmallLogo';
import { IrsstLogo } from '../components/IrsstLogo';
import { Loader2, ArrowLeft } from 'lucide-react';
import { logError } from '../lib/errorLogger';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Check if we have a token (for password reset form)
  const token = searchParams.get('token');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isResetForm, setIsResetForm] = useState(false);

  // Check if we're in reset mode or request mode
  useEffect(() => {
    if (token) {
      setIsResetForm(true);
    }
  }, [token]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      // Validate email format
      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
      if (!emailRegex.test(email.trim())) {
        throw new Error('Format d\'email invalide');
      }

      // Use the Edge Function to send the reset email
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de l\'envoi du lien de réinitialisation');
      }

      setSuccess(true);
    } catch (err) {
      console.error('Reset password error:', err);
      logError(err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword || loading) return;

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
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      console.error('Error resetting password:', error);
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
            {isResetForm ? 'Définir un nouveau mot de passe' : 'Réinitialisation du mot de passe'}
          </h2>

          {success ? (
            <div className="space-y-6">
              <div className="bg-green-500/20 border border-green-500/50 text-white px-4 py-3 rounded-md">
                {isResetForm ? (
                  <>
                    <p className="mb-2">Votre mot de passe a été mis à jour avec succès !</p>
                    <p className="text-sm">Vous allez être redirigé vers la page de connexion...</p>
                  </>
                ) : (
                  <>
                    <p className="mb-2">Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.</p>
                    <p className="text-sm">Veuillez vérifier votre boîte de réception et suivre les instructions.</p>
                  </>
                )}
              </div>

              <button
                onClick={() => navigate('/login')}
                className="w-full bg-[#2F4F4F] text-white py-3 px-4 rounded-md hover:bg-[#2F4F4F]/90 focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft size={20} />
                Retour à la connexion
              </button>
            </div>
          ) : isResetForm ? (
            <form onSubmit={handleResetPassword} className="space-y-6">
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

              <div className="flex flex-col space-y-3">
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

                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full bg-transparent text-white py-3 px-4 rounded-md border border-white/30 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={20} />
                  Retour à la connexion
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRequestReset} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-white text-sm font-medium mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-md bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                  placeholder="votre@email.com"
                  required
                  disabled={loading}
                />
                <p className="mt-2 text-sm text-white/70">
                  Entrez l'adresse email associée à votre compte pour recevoir un lien de réinitialisation.
                </p>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-white px-4 py-3 rounded-md">
                  {error}
                </div>
              )}

              <div className="flex flex-col space-y-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#2F4F4F] text-white py-3 px-4 rounded-md hover:bg-[#2F4F4F]/90 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span>Envoi en cours...</span>
                    </>
                  ) : (
                    'Envoyer le lien de réinitialisation'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full bg-transparent text-white py-3 px-4 rounded-md border border-white/30 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={20} />
                  Retour à la connexion
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}