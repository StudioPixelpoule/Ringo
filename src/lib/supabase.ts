import { createClient } from '@supabase/supabase-js';
import { SESSION_STORAGE_KEY, SESSION_DURATION } from './auth';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variables d\'environnement Supabase manquantes');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: window.localStorage,
    storageKey: SESSION_STORAGE_KEY,
    debug: import.meta.env.DEV,
    flowType: 'pkce',
    retryAttempts: 3,
    retryInterval: 2000,
    // Paramètres de session
    sessionTimeout: SESSION_DURATION,
    refreshTokenRotationInterval: SESSION_DURATION / 2
  },
  global: {
    headers: {
      'x-application-name': 'ringo',
      'x-client-info': 'web'
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Initialisation des listeners d'erreurs
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' && session) {
    // Mise à jour du token dans le storage
    localStorage.setItem(SESSION_STORAGE_KEY, session.access_token);
  }
});