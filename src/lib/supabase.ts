import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Fonction complète pour nettoyer l'état d'authentification
export const recoverAuth = async (redirectToLogin = true) => {
  try {
    console.log('Recovering authentication state...');
    
    // Nettoyage du stockage local
    const keysToRemove = [
      'sb-kitzhhrhlaevrtbqnbma-auth-token',
      'ringo_auth',
      'supabase.auth.token',
      'supabase.auth.refreshToken',
      'supabase-auth-token'
    ];
    
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn(`Failed to remove ${key} from localStorage`, e);
      }
    });
    
    // Déconnexion explicite avec scope global
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (e) {
      console.warn('Sign out failed, continuing with recovery', e);
    }
    
    // Force le rafraîchissement des instances
    await supabase.auth.initialize();
    
    // Redirection vers la page de connexion
    if (redirectToLogin && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    
    console.log('Authentication state recovered');
  } catch (e) {
    console.error('Recovery failed:', e);
    if (redirectToLogin && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: window.localStorage,
    storageKey: 'ringo_auth',
    debug: import.meta.env.DEV
  },
  global: {
    headers: {
      'x-application-name': 'ringo'
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Gestionnaire d'erreurs amélioré pour intercepter toutes les erreurs d'auth
const handleAuthError = async (error: any) => {
  if (
    error?.message?.includes('refresh_token_not_found') ||
    error?.message?.includes('Invalid Refresh Token') ||
    error?.message?.includes('JWT expired') ||
    error?.message?.includes('Invalid JWT') ||
    error?.status === 400 ||
    error?.code === 'PGRST301'
  ) {
    console.warn('Authentication error detected, recovering session...', error);
    await recoverAuth();
    return true;
  }
  return false;
};

// Wrapper pour les requêtes Supabase
export const safeQuery = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (await handleAuthError(error)) {
      throw new Error('Authentication error, please login again');
    }
    throw error;
  }
};

// Initialisation et configuration des écouteurs d'événements
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event);
  
  if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
    if (window.location.pathname !== '/login') {
      recoverAuth();
    }
  }
});

// Vérification initiale de session
supabase.auth.getSession().catch(error => {
  console.warn('Session check failed:', error);
  handleAuthError(error);
});

// Ajout d'un gestionnaire global pour les rejets non gérés
window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason?.name === 'AuthApiError' || 
    event.reason?.code === 'PGRST301' ||
    (event.reason?.error && event.reason.error.status === 400)
  ) {
    handleAuthError(event.reason);
  }
});