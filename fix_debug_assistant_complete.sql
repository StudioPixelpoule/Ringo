-- Script complet pour corriger l'Assistant de Débogage
-- Ce script met à jour la vue et vérifie les accès

-- PARTIE 1 : MISE À JOUR DE LA VUE
-- ================================

-- Supprimer l'ancienne vue
DROP VIEW IF EXISTS error_logs_with_users;

-- Recréer la vue avec la colonne name
CREATE VIEW error_logs_with_users 
WITH (security_invoker = on)
AS
SELECT 
  e.id,
  e.error,
  e.stack,
  e.context,
  e.user_id,
  e.created_at,
  e.status,
  e.resolution,
  p.email as user_email,
  p.name as user_name,
  p.role as user_role
FROM error_logs e
LEFT JOIN profiles p ON e.user_id = p.id;

-- Accorder l'accès à la vue
GRANT SELECT ON error_logs_with_users TO authenticated;

-- Ajouter un commentaire explicatif
COMMENT ON VIEW error_logs_with_users IS 'Vue pour les journaux d''erreurs avec informations utilisateur incluant le nom. Utilise SECURITY INVOKER pour appliquer les politiques RLS de l''utilisateur appelant.';

-- Message de confirmation
DO $$ 
BEGIN
  RAISE NOTICE 'Vue error_logs_with_users mise à jour avec succès !';
END $$;

-- PARTIE 2 : VÉRIFICATIONS
-- ========================

-- 1. Vérifier votre rôle actuel
SELECT 
  'Votre profil actuel :' as info,
  email,
  role,
  CASE 
    WHEN role = 'super_admin' THEN '✅ Vous êtes Super Admin'
    WHEN role = 'admin' THEN '⚠️ Vous êtes Admin (pas d''accès aux logs d''erreur)'
    ELSE '❌ Vous êtes Utilisateur (pas d''accès aux logs d''erreur)'
  END as acces_debug
FROM profiles 
WHERE id = auth.uid();

-- 2. Statistiques des erreurs (si vous êtes super admin)
SELECT 
  'Statistiques des erreurs :' as info,
  COUNT(*) as total_erreurs,
  COUNT(DISTINCT user_id) as utilisateurs_affectes,
  COUNT(CASE WHEN status = 'new' THEN 1 END) as nouvelles_erreurs,
  COUNT(CASE WHEN status = 'investigating' THEN 1 END) as en_cours,
  COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolues
FROM error_logs_with_users
WHERE is_super_admin(auth.uid());

-- 3. Afficher les 5 dernières erreurs avec noms d'utilisateurs
SELECT 
  'Dernières erreurs :' as info,
  error,
  created_at,
  status,
  COALESCE(user_name, 'Sans nom') || ' (' || user_email || ')' as utilisateur,
  user_role
FROM error_logs_with_users
WHERE is_super_admin(auth.uid())
ORDER BY created_at DESC
LIMIT 5;

-- 4. Utilisateurs sans nom défini
SELECT 
  'Utilisateurs sans nom :' as info,
  user_email,
  user_role,
  COUNT(*) as nombre_erreurs
FROM error_logs_with_users
WHERE user_name IS NULL 
  AND user_email IS NOT NULL
  AND is_super_admin(auth.uid())
GROUP BY user_email, user_role
ORDER BY nombre_erreurs DESC;

-- Message final
DO $$ 
BEGIN
  IF is_super_admin(auth.uid()) THEN
    RAISE NOTICE '✅ Script exécuté avec succès ! Vous pouvez maintenant utiliser l''Assistant de Débogage.';
  ELSE
    RAISE NOTICE '⚠️ Script exécuté mais vous n''êtes pas Super Admin. L''Assistant de Débogage ne sera pas accessible.';
  END IF;
END $$; 