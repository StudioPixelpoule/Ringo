import React, { useState, useEffect } from 'react';
import { Plus, Search, Send, Bot } from 'lucide-react';
import { supabase } from './lib/supabase';
import type { User } from '@supabase/supabase-js';

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Vérifier l'état de l'authentification
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#D9DDD1] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Bot className="text-[#E86A45]" size={40} />
              <h1 className="text-3xl font-bold text-[#E86A45]">RINGO</h1>
            </div>
            <p className="text-[#2F4F4F]">by AI</p>
          </div>

          <form onSubmit={handleLogin} className="bg-white rounded-lg shadow-lg p-8 space-y-6">
            <h2 className="text-2xl font-bold text-[#2F4F4F] text-center mb-6">Connexion</h2>
            
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-[#2F4F4F]">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-[#FFCDB6] text-[#2F4F4F] placeholder-[#2F4F4F] outline-none"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-[#2F4F4F]">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-[#FFCDB6] text-[#2F4F4F] placeholder-[#2F4F4F] outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#3C584E] text-white py-2 px-4 rounded-lg hover:bg-opacity-90 disabled:opacity-50"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Left Sidebar */}
      <div className="flex flex-col w-[300px]">
        {/* Conversations Section */}
        <div className="bg-[#D9DDD1] h-1/2 p-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-[#2F4F4F] text-lg font-medium">Conversations</h2>
            <button className="text-[#2F4F4F]">
              <Plus size={20} />
            </button>
          </div>
          <p className="text-[#2F4F4F] text-center mt-20">Aucune conversation</p>
        </div>
        
        {/* Documents Section */}
        <div className="bg-[#3C584E] h-1/2 p-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-white text-lg font-medium">Documents</h2>
            <button className="text-white">
              <Search size={20} />
            </button>
          </div>
          <p className="text-white text-center mt-20">Aucun document</p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-[#E86A45] p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Bot className="text-white" size={24} />
            <h1 className="text-white text-xl font-bold">RINGO</h1>
            <span className="text-white text-sm">by AI</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-[#FFCDB6] px-4 py-2 rounded">
              <span className="text-[#2F4F4F]">{user.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="bg-[#3C584E] text-white px-4 py-2 rounded hover:bg-opacity-90"
            >
              Déconnexion
            </button>
          </div>
        </div>

        {/* Chat Content */}
        <div className="flex-1 bg-white"></div>

        {/* Chat Input */}
        <div className="bg-[#E86A45] p-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Posez votre question à Ringo..."
              className="flex-1 px-4 py-2 rounded-lg bg-[#FFCDB6] text-[#2F4F4F] placeholder-[#2F4F4F] outline-none"
            />
            <button className="bg-[#3C584E] p-2 rounded-lg">
              <Send className="text-white" size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-[300px] bg-[#C9A959]">
        <div className="p-4">
          <h2 className="text-white text-lg font-medium mb-4">Rapports</h2>
          <div className="bg-white rounded-lg p-4">
            <h3 className="text-[#2F4F4F] font-medium mb-2">Modèles</h3>
            <p className="text-[#2F4F4F] text-center mt-4">Aucun modèle disponible</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;