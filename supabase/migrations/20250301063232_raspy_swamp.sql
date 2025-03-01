/*
  # Suppression des utilisateurs

  1. Suppression
    - Supprime tous les utilisateurs sauf theboxoflio@gmail.com
    - Préserve l'utilisateur administrateur principal
  
  2. Sécurité
    - Vérifie l'existence de l'utilisateur administrateur avant de procéder
    - Utilise une transaction pour garantir l'intégrité des données
*/

-- Commencer une transaction pour garantir l'atomicité des opérations
BEGIN;

-- Vérifier que l'utilisateur administrateur existe
DO $$
DECLARE
  admin_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE email = 'theboxoflio@gmail.com'
  ) INTO admin_exists;
  
  IF NOT admin_exists THEN
    RAISE EXCEPTION 'L''utilisateur administrateur theboxoflio@gmail.com n''existe pas. Opération annulée.';
  END IF;
END $$;

-- Supprimer tous les utilisateurs sauf l'administrateur
DELETE FROM auth.users
WHERE email != 'theboxoflio@gmail.com';

-- Valider la transaction
COMMIT;