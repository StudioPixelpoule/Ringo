import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Send, Upload } from 'lucide-react';
import { supabase } from './lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Document, Profile } from './lib/types';
import { RingoLogo } from './components/RingoLogo';
import { LogoutIcon } from './components/LogoutIcon';
import { DocumentStackIcon } from './components/DocumentStackIcon';
import { MindMapIcon } from './components/MindMapIcon';
import { MindMapModal } from './components/MindMapModal';
import { ImportWindow } from './components/ImportWindow';

interface FolderStructure {
  [key: string]: {
    files: Document[];
    subfolders: FolderStructure;
  };
}

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isMindMapOpen, setIsMindMapOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folderStructure, setFolderStructure] = useState<FolderStructure>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadDocuments();
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert([{ id: user.id, role: 'user' }])
          .select()
          .single();

        if (insertError) throw insertError;
        setProfile(newProfile);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Erreur lors du chargement du profil:', err);
    }
  };

  const buildFolderStructure = useCallback((docs: Document[]): FolderStructure => {
    const structure: FolderStructure = {
      '': { files: [], subfolders: {} }
    };

    docs.forEach(doc => {
      if (!doc.folder) {
        structure[''].files.push(doc);
        return;
      }

      const parts = doc.folder.split('/');
      let current = structure;
      let path = '';

      parts.forEach((part, index) => {
        path = path ? `${path}/${part}` : part;
        
        if (!current[part]) {
          current[part] = {
            files: [],
            subfolders: {}
          };
        }

        if (index === parts.length - 1) {
          current[part].files.push(doc);
        }

        current = current[part].subfolders;
      });
    });

    return structure;
  }, []);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const structure = buildFolderStructure(data || []);
      setFolderStructure(structure);
      setDocuments(data || []);
    } catch (err) {
      console.error('Erreur lors du chargement des documents:', err);
    }
  };

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
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      console.error('Erreur lors de la déconnexion:', err);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f15922] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-16">
            <RingoLogo className="text-white mx-auto mb-6" size={120} />
            <h1 className="text-5xl font-bold text-white">RINGO</h1>
          </div>

          <form onSubmit={handleLogin} className="bg-white bg-opacity-10 backdrop-blur-lg rounded-2xl shadow-xl p-8 space-y-6">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-white">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white bg-opacity-20 text-white placeholder-white placeholder-opacity-70 outline-none border border-white border-opacity-30 focus:border-opacity-70 transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-white">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white bg-opacity-20 text-white placeholder-white placeholder-opacity-70 outline-none border border-white border-opacity-30 focus:border-opacity-70 transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-neumorphic bg-[#2f5c54] text-white py-3 px-4 rounded-lg font-bold text-lg disabled:opacity-50 transition-all"
            >
              {loading ? 'Connexion...' : 'Allons-y !'}
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
        <div className="bg-[#cfd3bd] h-full p-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-[#2F4F4F] text-lg font-medium">Conversations</h2>
            <button className="btn-neumorphic bg-[#cfd3bd] text-[#2F4F4F] p-3 rounded-full hover:text-[#2F4F4F] focus:outline-none">
              <Plus size={20} />
            </button>
          </div>
          <p className="text-[#2F4F4F] text-center mt-20">Aucune conversation</p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-[#f15922] p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <RingoLogo className="text-white" size={64} />
            <div className="flex items-start">
              <h1 className="text-2xl font-bold text-white">RINGO</h1>
              <span className="text-white text-xs ml-1" style={{ verticalAlign: 'super' }}>by AI</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {profile?.role === 'admin' && (
              <button 
                onClick={() => setIsImportOpen(true)}
                className="btn-neumorphic bg-[#f15922] text-white p-3 rounded-full hover:text-white focus:outline-none"
                title="Importer un document"
              >
                <DocumentStackIcon className="text-white" size={24} />
              </button>
            )}
            <span className="text-white">{user.email}</span>
            <button
              onClick={handleLogout}
              className="btn-neumorphic bg-[#f15922] text-white p-3 rounded-full hover:text-white focus:outline-none"
              title="Déconnexion"
            >
              <LogoutIcon className="text-white" size={24} />
            </button>
          </div>
        </div>

        {/* Chat Content */}
        <div className="flex-1 bg-white"></div>

        {/* Chat Input */}
        <div className="bg-[#f15922] p-4">
          <div className="flex gap-2">
            <button 
              onClick={() => setIsMindMapOpen(true)}
              className="btn-neumorphic bg-[#3C584E] p-3 rounded-full"
              title="Voir la mind map"
            >
              <MindMapIcon className="text-white" size={20} />
            </button>
            <input
              type="text"
              placeholder="Posez votre question à Ringo..."
              className="flex-1 px-4 py-2 rounded-lg bg-[#FFCDB6] text-[#2F4F4F] placeholder-[#2F4F4F] outline-none"
            />
            <button className="btn-neumorphic bg-[#3C584E] p-3 rounded-full">
              <Send className="text-white" size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-[300px] bg-[#dba747]">
        <div className="p-4">
          <h2 className="text-white text-lg font-medium mb-4">Rapports</h2>
          <div className="bg-white rounded-lg p-4">
            <h3 className="text-[#2F4F4F] font-medium mb-2">Modèles</h3>
            <p className="text-[#2F4F4F] text-center mt-4">Aucun modèle disponible</p>
          </div>
        </div>
      </div>

      {/* MindMap Modal */}
      <MindMapModal
        isOpen={isMindMapOpen}
        onClose={() => setIsMindMapOpen(false)}
        documents={documents}
      />

      {/* Import Window */}
      {profile?.role === 'admin' && (
        <ImportWindow
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          userId={user.id}
          onDocumentAdded={loadDocuments}
          folderStructure={folderStructure}
        />
      )}
    </div>
  );
}

export default App;