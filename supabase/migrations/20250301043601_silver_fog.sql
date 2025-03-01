/*
  # Création du système de logs

  1. Nouvelle Table
    - `logs`
      - `id` (uuid, primary key)
      - `timestamp` (timestamptz)
      - `level` (text) - 'info', 'warning', 'error'
      - `message` (text)
      - `details` (jsonb)
      - `source` (text) - composant source du log
      - `user_id` (uuid, nullable) - référence à l'utilisateur concerné
  2. Index
    - Index sur timestamp pour des requêtes efficaces
    - Index sur level pour filtrer par type de log
  3. Politique RLS
    - Seuls les administrateurs peuvent lire les logs
*/

-- Création de la table logs
CREATE TABLE IF NOT EXISTS logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz DEFAULT now(),
  level text NOT NULL CHECK (level IN ('info', 'warning', 'error')),
  message text NOT NULL,
  details jsonb,
  source text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Création des index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);

-- Activation de RLS
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre aux administrateurs de lire les logs
CREATE POLICY "Admins can read logs"
  ON logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Politique pour permettre aux administrateurs d'insérer des logs
CREATE POLICY "Admins can insert logs"
  ON logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Fonction pour nettoyer automatiquement les logs anciens (plus de 30 jours)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM logs
  WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Fonction pour ajouter un log depuis le code
CREATE OR REPLACE FUNCTION log_event(
  p_level text,
  p_message text,
  p_details jsonb DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO logs (level, message, details, source, user_id)
  VALUES (p_level, p_message, p_details, p_source, p_user_id)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql;