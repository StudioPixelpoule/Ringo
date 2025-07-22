-- Script pour vérifier l'accès super admin et les données visibles

-- 1. Vérifier le rôle de l'utilisateur actuel
SELECT 
  id,
  email,
  role,
  status,
  name
FROM profiles 
WHERE id = auth.uid();

-- 2. Vérifier si l'utilisateur est super admin
SELECT is_super_admin(auth.uid()) as "Est Super Admin";

-- 3. Compter le nombre total d'erreurs dans error_logs
SELECT COUNT(*) as "Total erreurs dans error_logs"
FROM error_logs;

-- 4. Compter le nombre d'erreurs visibles via la vue
SELECT COUNT(*) as "Erreurs visibles via la vue"
FROM error_logs_with_users;

-- 5. Afficher les 10 dernières erreurs avec informations utilisateur
SELECT 
  e.error,
  e.created_at,
  e.status,
  e.user_email,
  e.user_name,
  e.user_role,
  CASE 
    WHEN e.user_name IS NULL THEN 'Nom non défini'
    ELSE e.user_name
  END as nom_affiche
FROM error_logs_with_users e
ORDER BY e.created_at DESC
LIMIT 10;

-- 6. Vérifier les utilisateurs qui ont des erreurs mais pas de nom
SELECT DISTINCT
  user_email,
  user_name,
  user_role,
  COUNT(*) as nombre_erreurs
FROM error_logs_with_users
WHERE user_name IS NULL
GROUP BY user_email, user_name, user_role
ORDER BY nombre_erreurs DESC; 