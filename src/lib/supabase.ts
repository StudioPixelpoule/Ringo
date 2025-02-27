import { createClient } from "@supabase/supabase-js";

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
  try { console.log('[SUPABASE] Tentative de récupération de la session...');
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

// Intercepter les erreurs d'authentification
supabase.auth.onAuthStateChange((event, session) => {
  console.log('[SUPABASE] Événement d\'authentification:', event);
  
  if (event === 'SIGNED_OUT') {
    // Nettoyer le stockage local
    localStorage.removeItem('ringo-auth-storage-key');
    console.log('[SUPABASE] Session terminée, stockage local nettoyé');
  }
});