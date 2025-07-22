# Correction de l'erreur 400 - Colonne name manquante

## Problème
L'erreur 400 lors de la mise à jour du nom d'un utilisateur est causée par l'absence de la colonne `name` dans la table `profiles` de la base de données.

## Cause
La migration qui ajoute cette colonne avait une date future (juillet 2025) et n'a donc pas été exécutée sur le serveur de production.

## Solution

### Option 1 : Exécuter le script SQL manuellement

1. Connectez-vous à votre dashboard Supabase
2. Allez dans l'éditeur SQL
3. Exécutez ce script :

```sql
-- Ajouter la colonne name à la table profiles si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'name'
    ) THEN
        ALTER TABLE profiles 
        ADD COLUMN name text;
        
        RAISE NOTICE 'Colonne name ajoutée à la table profiles';
    ELSE
        RAISE NOTICE 'La colonne name existe déjà dans la table profiles';
    END IF;
END $$;

-- Mettre à jour la vue error_logs_with_users
DROP VIEW IF EXISTS error_logs_with_users;

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

GRANT SELECT ON error_logs_with_users TO authenticated;

-- Vérifier que la colonne a bien été ajoutée
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;
```

### Option 2 : Attendre le déploiement automatique

Le fichier de migration a été renommé avec une date correcte et sera exécuté automatiquement lors du prochain déploiement.

## Vérification

Après avoir exécuté le script ou après le déploiement, vous devriez pouvoir :
- Modifier le nom des utilisateurs sans erreur 400
- Voir les noms des utilisateurs dans le journal des erreurs 