import { supabase } from './supabase';

// Gestion des sessions
export const SESSION_STORAGE_KEY = 'ringo_auth';
export const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 jours

// Fonction de nettoyage améliorée
export const recoverAuth = async (redirectToLogin = true) => {
  try {
    console.log('Nettoyage de l\'état d\'authentification...');
    
    // Nettoyage du stockage
    const keysToRemove = [
      SESSION_STORAGE_KEY,
      'sb-kitzhhrhlaevrtbqnbma-auth-token',
      'supabase.auth.token',
      'supabase-auth-token',
      'supabase.auth.refreshToken',
      'supabase.auth.session'
    ];
    
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch (e) {
        console.warn(`Échec de suppression de ${key}`, e);
      }
    });
    
    // Déconnexion globale
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (e) {
      console.warn('Échec de déconnexion, poursuite du nettoyage', e);
    }
    
    // Rafraîchissement forcé
    try {
      await supabase.auth.refreshSession();
      await supabase.auth.getSession();
    } catch (e) {
      console.warn('Échec du rafraîchissement, poursuite du nettoyage', e);
    }
    
    // Redirection si nécessaire
    if (redirectToLogin && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    
    console.log('État d\'authentification nettoyé');
  } catch (e) {
    console.error('Échec du nettoyage:', e);
    if (redirectToLogin && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
};

// Gestionnaire d'erreurs amélioré
export const handleAuthError = async (error: any) => {
  const authErrors = [
    'refresh_token_not_found',
    'Invalid Refresh Token',
    'JWT expired',
    'Invalid JWT',
    'invalid token',
    'invalid signature',
    'invalid claim',
    'token is expired',
    'invalid refresh token'
  ];

  const isAuthError = 
    error?.message && authErrors.some(msg => error.message.includes(msg)) ||
    error?.status === 400 ||
    error?.code === 'PGRST301' ||
    error?.code === '401' ||
    error?.code === 'invalid_grant';

  if (isAuthError) {
    console.warn('Erreur d\'authentification détectée, nettoyage...', error);
    await recoverAuth();
    return true;
  }
  return false;
};

// Wrapper sécurisé pour les requêtes
export const safeQuery = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    const result = await fn();
    return result;
  } catch (error: any) {
    if (await handleAuthError(error)) {
      throw new Error('Session expirée, reconnexion nécessaire');
    }
    throw error;
  }
};

// Initialisation de l'authentification
export const initAuth = () => {
  // Écoute des changements d'état
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('Changement d\'état auth:', event);
    
    switch (event) {
      case 'SIGNED_OUT':
      case 'USER_DELETED':
        await recoverAuth();
        break;
        
      case 'TOKEN_REFRESHED':
        if (session) {
          // Vérification du profil
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('status')
            .eq('id', session.user.id)
            .single();
            
          if (error || !profile?.status) {
            console.warn('Profil invalide, déconnexion');
            await recoverAuth();
          } else {
            console.log('Token rafraîchi avec succès');
          }
        }
        break;
        
      case 'SIGNED_IN':
        // Mise à jour de la dernière activité
        if (session) {
          await supabase
            .from('active_sessions')
            .upsert({
              user_id: session.user.id,
              last_active_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + SESSION_DURATION).toISOString()
            })
            .single();
        }
        break;
    }
  });

  // Vérification initiale
  supabase.auth.getSession().catch(error => {
    console.warn('Échec de vérification de session:', error);
    handleAuthError(error);
  });

  // Gestionnaire d'erreurs global
  window.addEventListener('unhandledrejection', (event) => {
    if (
      event.reason?.name === 'AuthApiError' || 
      event.reason?.code === 'PGRST301' ||
      event.reason?.status === 400 ||
      event.reason?.code === '401'
    ) {
      handleAuthError(event.reason);
    }
  });
};