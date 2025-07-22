# Correction de l'Assistant de Débogage

## Problème
L'Assistant de Débogage ne montre pas les noms des utilisateurs associés aux erreurs pour les super admins.

## Cause
La vue `error_logs_with_users` n'inclut pas la colonne `name` ou n'a pas été mise à jour après l'ajout de cette colonne.

## Solution

### Étape 1 : Mettre à jour la vue error_logs_with_users

Exécutez le contenu du fichier `update_error_logs_view.sql` dans l'éditeur SQL de Supabase :

```sql
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
```

### Étape 2 : Vérifier votre accès

Exécutez le contenu du fichier `check_super_admin_access.sql` pour vérifier :
- Que vous êtes bien connecté en tant que super admin
- Que vous pouvez voir toutes les erreurs
- Que les noms des utilisateurs sont bien récupérés

### Étape 3 : Tester l'Assistant de Débogage

1. Rafraîchissez votre application
2. Ouvrez l'Assistant de Débogage (bouton triangle d'alerte dans l'en-tête)
3. Vous devriez maintenant voir :
   - Toutes les erreurs de tous les utilisateurs
   - Les noms des utilisateurs (quand définis)
   - Les emails des utilisateurs

## Fonctionnalités de l'Assistant de Débogage

### Pour les Super Admins :
- ✅ Vue complète de toutes les erreurs système
- ✅ Informations sur les utilisateurs affectés (nom + email)
- ✅ Dashboard avec statistiques globales
- ✅ Génération automatique de prompts Cursor pour débugger
- ✅ Gestion des statuts des erreurs (nouvelle, en cours, résolue)
- ✅ Filtrage par priorité et statut
- ✅ Recherche par email ou nom d'utilisateur

### Politiques de sécurité :
- Seuls les super admins peuvent accéder à l'Assistant de Débogage
- Les données sont protégées par RLS (Row Level Security)
- La vue utilise SECURITY INVOKER pour hériter des permissions de l'utilisateur 