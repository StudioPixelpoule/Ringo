-- Script pour mettre à jour la vue error_logs_with_users
-- Cette vue doit inclure le nom des utilisateurs pour l'Assistant de Débogage

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

-- Vérifier les politiques RLS existantes sur error_logs
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'error_logs';

-- Vérifier la structure de la vue
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'error_logs_with_users'
ORDER BY ordinal_position; 