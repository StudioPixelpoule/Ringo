import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { SmallLogo } from '../components/SmallLogo';
import { IrsstLogo } from '../components/IrsstLogo';
import { Loader2 } from 'lucide-react';
import { config } from '../lib/config';
import { handleError } from '../lib/errorHandler';
import { AuthErrorType, NetworkErrorType } from '../lib/errorTypes';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !email.trim() || !password) return;

    setLoading(true);
    setError(null);

    try {
      // Clear any existing session data
      sessionStorage.clear();
      localStorage.clear();

      // Check network status first
      if (!navigator.onLine) {
        throw new Error('Pas de connexion internet');
      }

      // First check if user exists and is active
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('status')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (profileError) {
        if (profileError.code === 'PGRST301' || profileError.code === '401') {
          throw new Error('Email ou mot de passe incorrect');
        }
        throw profileError;
      }

      if (profile && !profile.status) {
        throw new Error('Ce compte a été désactivé');
      }

      // Then attempt to sign in
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          throw new Error('Email ou mot de passe incorrect');
        }
        if (signInError.message.includes('too many requests')) {
          throw new Error('Trop de tentatives de connexion. Veuillez réessayer plus tard.');
        }
        throw signInError;
      }

      if (!data.session) {
        throw new Error('Échec de la connexion');
      }

      // Get redirect path from location state or default to home
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (error) {
      const appError = await handleError(error, {
        component: 'Login',
        action: 'handleLogin',
        email: email.trim().toLowerCase(),
        networkStatus: {
          online: navigator.onLine,
          connectionType: ('connection' in navigator) 
            ? (navigator as any).connection?.effectiveType 
            : 'unknown'
        }
      });

      // Set user-friendly error message
      if (appError.type === NetworkErrorType.OFFLINE) {
        setError('Pas de connexion internet');
      } else if (appError.type === AuthErrorType.INVALID_CREDENTIALS) {
        setError('Email ou mot de passe incorrect');
      } else {
        setError(appError.getUserMessage());
      }
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
              disabled={loading || !email || !password}
              className="w-full bg-[#2F4F4F] text-white py-3 px-4 rounded-md hover:bg-[#2F4F4F]/90 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Connexion en cours...</span>
                </>
              ) : (
                'Allons-y !'
              )}
            </button>
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
          <div className="mt-4 text-sm text-white/70 text-center">
            {config.app.copyright}
            <div className="text-xs mt-1">Version {config.app.version} ({config.app.buildDate})</div>
          </div>
        </div>
      </div>
    </div>
  );
}