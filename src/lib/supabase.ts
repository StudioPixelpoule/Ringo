import { createClient } from "@supabase/supabase-js";
import { userService } from "./userService";
import { logger } from "./logger";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Les variables d'environnement Supabase sont manquantes. Veuillez configurer VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'ringo-auth-storage-key'
  },
  global: {
    headers: { 'x-application-name': 'ringo' }
  },
  // Optimisation des requêtes réseau
  realtime: {
    params: {
      eventsPerSecond: 5 // Limiter le nombre d'événements par seconde
    }
  }
});

// Fonction utilitaire pour vérifier la connexion
export const checkSupabaseConnection = async () => {
  try {
    const { error } = await supabase.from('documents').select('count', { count: 'exact', head: true });
    if (error) {
      console.error('[SUPABASE] Erreur de connexion à Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SUPABASE] Erreur lors de la vérification de la connexion:', err);
    return false;
  }
};

// Fonction pour gérer les erreurs d'authentification
export const handleAuthError = async () => {
  try {
    console.log('[SUPABASE] Tentative de récupération de la session...');
    const { data, error } = await supabase.auth.getSession();
    
    if (error || !data.session) {
      console.log('[SUPABASE] Aucune session valide trouvée, déconnexion...');
      await supabase.auth.signOut();
      return false;
    }
    
    console.log('[SUPABASE] Session récupérée avec succès');
    return true;
  } catch (err) {
    console.error('[SUPABASE] Erreur lors de la gestion de l\'authentification:', err);
    return false;
  }
};

// Cache pour les requêtes fréquentes
const queryCache = new Map<string, {data: any, timestamp: number}>();
const CACHE_TTL = 60000; // 1 minute

// Fonction pour récupérer des données avec cache
export const fetchWithCache = async (
  table: string, 
  query: any, 
  cacheKey?: string, 
  ttl: number = CACHE_TTL
) => {
  const key = cacheKey || `${table}-${JSON.stringify(query)}`;
  const now = Date.now();
  
  // Vérifier si les données sont en cache et valides
  const cached = queryCache.get(key);
  if (cached && (now - cached.timestamp) < ttl) {
    return { data: cached.data, error: null, source: 'cache' };
  }
  
  // Exécuter la requête
  const result = await query;
  
  // Mettre en cache si pas d'erreur
  if (!result.error && result.data) {
    queryCache.set(key, { data: result.data, timestamp: now });
  }
  
  return { ...result, source: 'network' };
};

// Intercepter les événements d'authentification
supabase.auth.onAuthStateChange((event, session) => {
  console.log('[SUPABASE] Événement d\'authentification:', event);
  
  // Utiliser une vérification plus sûre pour les événements
  if (event === 'SIGNED_OUT') {
    // Nettoyer le stockage local
    localStorage.removeItem('ringo-auth-storage-key');
    // Vider le cache
    queryCache.clear();
    console.log('[SUPABASE] Session terminée, stockage local nettoyé');
  } else if (event === 'SIGNED_IN' && session) {
    // Enregistrer la session utilisateur
    const userAgent = navigator.userAgent;
    userService.recordUserSession(session.user.id, undefined, userAgent)
      .catch(error => {
        logger.error('Erreur lors de l\'enregistrement de la session utilisateur', { error }, 'Auth');
      });
  }
});

// Intercepter les requêtes pour mettre à jour l'activité utilisateur
const originalSetAuth = supabase.realtime.setAuth;
supabase.realtime.setAuth = async (token) => {
  try {
    // Vérifier si le token est défini avant d'appeler la fonction originale
    if (token) {
      const result = await originalSetAuth(token);
      
      // Mettre à jour l'activité utilisateur si connecté
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        userService.updateUserActivity(data.session.user.id)
          .catch(error => {
            logger.error('Erreur lors de la mise à jour de l\'activité utilisateur', { error }, 'Auth');
          });
      }
      
      return result;
    } else {
      console.log('[SUPABASE] Token non défini, ignoré');
      return null;
    }
  } catch (error) {
    console.error('[SUPABASE] Erreur lors de la mise à jour du token:', error);
    logger.error('Erreur lors de la mise à jour du token', { error }, 'Auth');
    return null;
  }
};