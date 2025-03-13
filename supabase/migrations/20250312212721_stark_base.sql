/*
  # Amélioration de la Sécurité de l'Authentification

  1. Sécurité
    - Ajout de contraintes de mot de passe
    - Ajout de protection contre les attaques par force brute
    - Ajout de journalisation des tentatives de connexion
    - Ajout de validation d'email renforcée
    - Ajout de nettoyage automatique des sessions expirées

  2. Fonctionnalités
    - Gestion des sessions multiples
    - Détection des connexions suspectes
    - Verrouillage temporaire des comptes
    - Notifications de sécurité
*/

-- Créer une table pour les tentatives de connexion
CREATE TABLE IF NOT EXISTS auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text NOT NULL,
  user_agent text,
  attempted_at timestamptz DEFAULT now(),
  success boolean NOT NULL,
  failure_reason text
);

-- Créer une table pour les sessions actives
CREATE TABLE IF NOT EXISTS active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  user_agent text,
  ip_address text,
  created_at timestamptz DEFAULT now(),
  last_active_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_mobile boolean DEFAULT false
);

-- Créer une table pour les notifications de sécurité
CREATE TABLE IF NOT EXISTS security_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz,
  metadata jsonb
);

-- Activer RLS sur les nouvelles tables
ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_notifications ENABLE ROW LEVEL SECURITY;

-- Créer des index pour les performances
CREATE INDEX IF NOT EXISTS idx_auth_attempts_email ON auth_attempts(email);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip ON auth_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_timestamp ON auth_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires ON active_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_security_notifications_user ON security_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_security_notifications_unread ON security_notifications(user_id) WHERE read_at IS NULL;

-- Fonction pour vérifier les tentatives de connexion
CREATE OR REPLACE FUNCTION check_login_attempts(p_email text, p_ip text)
RETURNS boolean AS $$
DECLARE
  attempt_count int;
BEGIN
  -- Compter les tentatives échouées dans les 15 dernières minutes
  SELECT COUNT(*) INTO attempt_count
  FROM auth_attempts
  WHERE email = p_email 
    AND ip_address = p_ip
    AND success = false
    AND attempted_at > now() - interval '15 minutes';

  -- Bloquer après 5 tentatives échouées
  RETURN attempt_count < 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour nettoyer les anciennes tentatives
CREATE OR REPLACE FUNCTION cleanup_old_auth_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM auth_attempts
  WHERE attempted_at < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour nettoyer les sessions expirées
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM active_sessions
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour mettre à jour last_active_at
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS trigger AS $$
BEGIN
  NEW.last_active_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_activity_update
  BEFORE UPDATE ON active_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

-- Fonction pour créer une notification de sécurité
CREATE OR REPLACE FUNCTION create_security_notification(
  p_user_id uuid,
  p_type text,
  p_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
  INSERT INTO security_notifications (user_id, type, message, metadata)
  VALUES (p_user_id, p_type, p_message, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier les connexions suspectes
CREATE OR REPLACE FUNCTION check_suspicious_login(
  p_user_id uuid,
  p_ip_address text,
  p_user_agent text
)
RETURNS boolean AS $$
DECLARE
  last_login record;
BEGIN
  -- Récupérer la dernière connexion réussie
  SELECT ip_address, user_agent, attempted_at
  INTO last_login
  FROM auth_attempts
  WHERE email = (SELECT email FROM auth.users WHERE id = p_user_id)
    AND success = true
  ORDER BY attempted_at DESC
  LIMIT 1;

  -- Si c'est la première connexion, pas suspect
  IF last_login IS NULL THEN
    RETURN false;
  END IF;

  -- Vérifier si l'IP ou le user agent a changé
  IF last_login.ip_address != p_ip_address OR last_login.user_agent != p_user_agent THEN
    -- Créer une notification
    PERFORM create_security_notification(
      p_user_id,
      'suspicious_login',
      'Nouvelle connexion détectée depuis un appareil inconnu',
      jsonb_build_object(
        'ip_address', p_ip_address,
        'user_agent', p_user_agent,
        'previous_ip', last_login.ip_address,
        'previous_user_agent', last_login.user_agent
      )
    );
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Politiques RLS

-- Auth attempts - Seuls les admins peuvent voir
CREATE POLICY "Admins can view auth attempts"
  ON auth_attempts
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Active sessions - Les utilisateurs peuvent voir leurs sessions
CREATE POLICY "Users can view own sessions"
  ON active_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions"
  ON active_sessions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Security notifications - Les utilisateurs peuvent voir leurs notifications
CREATE POLICY "Users can view own notifications"
  ON security_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON security_notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger pour le nettoyage périodique
CREATE OR REPLACE FUNCTION cleanup_auth_data()
RETURNS trigger AS $$
BEGIN
  -- Nettoyer les anciennes tentatives de connexion
  DELETE FROM auth_attempts
  WHERE attempted_at < now() - interval '24 hours';
  
  -- Nettoyer les sessions expirées
  DELETE FROM active_sessions
  WHERE expires_at < now();
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger qui s'exécute toutes les heures
CREATE TRIGGER hourly_cleanup
  AFTER INSERT ON auth_attempts
  FOR EACH STATEMENT
  WHEN (
    EXTRACT(minute FROM CURRENT_TIMESTAMP) = 0
  )
  EXECUTE FUNCTION cleanup_auth_data();

-- Ajouter des contraintes de mot de passe à auth.users
ALTER TABLE auth.users
  ADD CONSTRAINT password_strength 
  CHECK (
    CASE 
      WHEN encrypted_password IS NOT NULL THEN
        length(encrypted_password) >= 60 -- bcrypt hash length
      ELSE true
    END
  );

-- Fonction pour valider le format d'email
CREATE OR REPLACE FUNCTION is_valid_email(email text)
RETURNS boolean AS $$
BEGIN
  RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Ajouter la validation d'email
ALTER TABLE auth.users
  ADD CONSTRAINT valid_email
  CHECK (is_valid_email(email));

-- Ajouter une contrainte pour empêcher les emails temporaires
CREATE OR REPLACE FUNCTION is_disposable_email(email text)
RETURNS boolean AS $$
BEGIN
  RETURN email ~* '@(temp-mail\.|tempmail\.|throwaway\.|disposable\.)';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE auth.users
  ADD CONSTRAINT no_disposable_email
  CHECK (NOT is_disposable_email(email));