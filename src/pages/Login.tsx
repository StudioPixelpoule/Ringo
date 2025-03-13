import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // First check if user exists and is active
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('status')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (profileError) {
        throw new Error('Erreur lors de la vérification du profil');
      }

      if (profile && !profile.status) {
        throw new Error('Ce compte a été désactivé');
      }

      // Then attempt to sign in with retry logic
      let attempts = 0;
      const maxAttempts = 3;
      let lastError;

      while (attempts < maxAttempts) {
        try {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password
          });

          if (!signInError) {
            // Success - navigate to home
            navigate('/');
            return;
          }

          lastError = signInError;
        } catch (e) {
          lastError = e;
        }

        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

      // If we get here, all attempts failed
      if (lastError?.message?.includes('Invalid login credentials')) {
        throw new Error('Email ou mot de passe incorrect');
      }
      throw lastError;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f15922] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 flex items-center justify-center -mb-2">
            <Logo />
          </div>
          <h1 className="text-white text-4xl font-bold flex items-baseline">
            RINGO
            <sup className="text-sm ml-1">By AI</sup>
          </h1>
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
          </form>
        </div>
      </div>
    </div>
  );
}