import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { SmallLogo } from '../components/SmallLogo';
import { IrsstLogo } from '../components/IrsstLogo';
import packageJson from '../../package.json';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      console.log('Attempting login for:', email);
      
      // Clear any existing auth data to prevent conflicts
      localStorage.clear();
      sessionStorage.clear();
      
      // First check if user exists and is active
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('status')
          .eq('email', email.trim().toLowerCase())
          .maybeSingle();

        if (profileError) {
          console.error('Profile check error:', profileError);
          if (profileError.message.includes('Invalid API key')) {
            throw new Error('Erreur de configuration du serveur. Veuillez contacter l\'administrateur.');
          }
          throw new Error('Erreur lors de la vérification du profil');
        }

        if (profile && !profile.status) {
          throw new Error('Ce compte a été désactivé');
        }
      } catch (error) {
        // If the error is related to API key or auth, we'll try to proceed with login anyway
        // as the RLS policies might still allow the login to work
        if (!(error instanceof Error && error.message.includes('Erreur de configuration du serveur'))) {
          console.warn('Profile check warning, proceeding with login attempt:', error);
        } else {
          throw error;
        }
      }

      // Then attempt to sign in
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (signInError) {
        console.error('Sign in error:', signInError);
        if (signInError.message.includes('Invalid login credentials')) {
          throw new Error('Email ou mot de passe incorrect');
        }
        throw signInError;
      }

      console.log('Login successful, user:', data.user);

      // Check if user needs to change password
      if (data.user) {
        try {
          const { data: userProfile, error: userProfileError } = await supabase
            .from('profiles')
            .select('password_changed, role')
            .eq('id', data.user.id)
            .single();
          
          if (userProfileError) {
            console.error('User profile fetch error:', userProfileError);
            throw userProfileError;
          }
          
          console.log('User profile:', userProfile);
          
          // If password_changed is false or null, redirect to change password page
          if (userProfile && (userProfile.password_changed === false || userProfile.password_changed === null)) {
            navigate('/change-password');
            return;
          }
        } catch (profileError) {
          console.error('Error checking password status:', profileError);
          // Continue to home page even if this check fails
        }
      }

      // If password is already changed, navigate to home
      navigate('/');
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate('/reset-password');
  };

  return (
    <div className="min-h-screen bg-[#f15922] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 flex items-center justify-center -mb-2">
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
          <form onSubmit={handleLogin} className="space-y-6">
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
            </div>

            <div>
              <label htmlFor="password" className="block text-white text-sm font-medium mb-2">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-md bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                placeholder="••••••••"
                required
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
              className="w-full bg-[#2F4F4F] text-white py-3 px-4 rounded-md hover:bg-[#2F4F4F]/90 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Connexion...' : 'Allons-y !'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-white/80 hover:text-white text-sm transition-colors"
              >
                Mot de passe oublié ?
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 flex flex-col items-center text-white">
          <span className="mb-2">Propulsé par</span>
          <div className="w-64">
            <svg viewBox="0 0 1000 200" fill="currentColor">
              <text x="500" y="100" fontSize="60" fontFamily="Arial" fontWeight="300" textAnchor="middle">En mode</text>
              <text x="500" y="180" fontSize="100" fontFamily="Arial" fontWeight="900" textAnchor="middle">SOLUTIONS</text>
            </svg>
          </div>
          <div className="mt-8 text-xs text-white/70 text-center">
            <p>Version {packageJson.version}</p>
            <p>© {new Date().getFullYear()} En Mode Solutions. Tous droits réservés.</p>
          </div>
        </div>
      </div>
    </div>
  );
}