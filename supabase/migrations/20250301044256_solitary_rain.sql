-- Mise à jour de la table profiles pour ajouter les champs nécessaires
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_activity timestamptz;

-- Mise à jour des rôles pour inclure le rôle 'reader'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'user', 'reader'));

-- Table pour stocker l'historique des connexions
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ip_address text,
  user_agent text,
  login_at timestamptz DEFAULT now(),
  logout_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Activation de RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre aux administrateurs de lire les sessions
CREATE POLICY "Admins can read user sessions"
  ON user_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Politique pour permettre aux utilisateurs de lire leurs propres sessions
CREATE POLICY "Users can read own sessions"
  ON user_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Politique pour permettre aux utilisateurs d'insérer leurs propres sessions
CREATE POLICY "Users can insert own sessions"
  ON user_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Politique pour permettre aux utilisateurs de mettre à jour leurs propres sessions
CREATE POLICY "Users can update own sessions"
  ON user_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fonction pour mettre à jour la dernière activité d'un utilisateur
CREATE OR REPLACE FUNCTION update_user_last_activity()
RETURNS trigger AS $$
BEGIN
  UPDATE profiles
  SET last_activity = now()
  WHERE id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour mettre à jour la dernière connexion d'un utilisateur
CREATE OR REPLACE FUNCTION update_user_last_login()
RETURNS trigger AS $$
BEGIN
  UPDATE profiles
  SET last_login = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour mettre à jour la dernière connexion lors de l'insertion d'une session
CREATE TRIGGER on_user_session_created
  AFTER INSERT ON user_sessions
  FOR EACH ROW EXECUTE FUNCTION update_user_last_login();

-- Fonction pour créer un nouvel utilisateur avec un mot de passe aléatoire
CREATE OR REPLACE FUNCTION admin_create_user(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_role text DEFAULT 'user'
)
RETURNS json AS $$
DECLARE
  v_user_id uuid;
  v_temp_password text;
  v_result json;
BEGIN
  -- Générer un mot de passe temporaire aléatoire
  v_temp_password := encode(gen_random_bytes(8), 'hex');
  
  -- Créer l'utilisateur dans auth.users
  INSERT INTO auth.users (
    email,
    raw_user_meta_data,
    created_at
  )
  VALUES (
    p_email,
    jsonb_build_object(
      'first_name', p_first_name,
      'last_name', p_last_name
    ),
    now()
  )
  RETURNING id INTO v_user_id;
  
  -- Définir le mot de passe
  UPDATE auth.users
  SET encrypted_password = crypt(v_temp_password, gen_salt('bf'))
  WHERE id = v_user_id;
  
  -- Mettre à jour le profil
  UPDATE profiles
  SET 
    first_name = p_first_name,
    last_name = p_last_name,
    role = p_role
  WHERE id = v_user_id;
  
  -- Retourner les informations
  v_result := json_build_object(
    'user_id', v_user_id,
    'email', p_email,
    'temp_password', v_temp_password
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour désactiver un utilisateur
CREATE OR REPLACE FUNCTION admin_disable_user(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Mettre à jour le statut dans profiles
  UPDATE profiles
  SET status = 'inactive'
  WHERE id = p_user_id;
  
  -- Désactiver l'utilisateur dans auth.users
  UPDATE auth.users
  SET is_sso_user = true, -- Empêche la connexion par mot de passe
      raw_app_meta_data = raw_app_meta_data || jsonb_build_object('disabled', true)
  WHERE id = p_user_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour réactiver un utilisateur
CREATE OR REPLACE FUNCTION admin_enable_user(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Mettre à jour le statut dans profiles
  UPDATE profiles
  SET status = 'active'
  WHERE id = p_user_id;
  
  -- Réactiver l'utilisateur dans auth.users
  UPDATE auth.users
  SET is_sso_user = false,
      raw_app_meta_data = raw_app_meta_data - 'disabled'
  WHERE id = p_user_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour supprimer un utilisateur
CREATE OR REPLACE FUNCTION admin_delete_user(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Supprimer l'utilisateur de auth.users (cascade supprimera le profil)
  DELETE FROM auth.users
  WHERE id = p_user_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour mettre à jour un utilisateur
CREATE OR REPLACE FUNCTION admin_update_user(
  p_user_id uuid,
  p_email text DEFAULT NULL,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_role text DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
  -- Mettre à jour l'email si fourni
  IF p_email IS NOT NULL THEN
    UPDATE auth.users
    SET email = p_email,
        raw_user_meta_data = raw_user_meta_data || 
          jsonb_build_object(
            'first_name', COALESCE(p_first_name, raw_user_meta_data->>'first_name'),
            'last_name', COALESCE(p_last_name, raw_user_meta_data->>'last_name')
          )
    WHERE id = p_user_id;
  END IF;
  
  -- Mettre à jour le profil
  UPDATE profiles
  SET 
    first_name = COALESCE(p_first_name, first_name),
    last_name = COALESCE(p_last_name, last_name),
    role = COALESCE(p_role, role)
  WHERE id = p_user_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour réinitialiser le mot de passe d'un utilisateur
CREATE OR REPLACE FUNCTION admin_reset_user_password(p_user_id uuid)
RETURNS text AS $$
DECLARE
  v_temp_password text;
BEGIN
  -- Générer un mot de passe temporaire aléatoire
  v_temp_password := encode(gen_random_bytes(8), 'hex');
  
  -- Mettre à jour le mot de passe
  UPDATE auth.users
  SET encrypted_password = crypt(v_temp_password, gen_salt('bf'))
  WHERE id = p_user_id;
  
  RETURN v_temp_password;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour forcer la déconnexion d'un utilisateur
CREATE OR REPLACE FUNCTION admin_force_logout(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Invalider toutes les sessions de l'utilisateur
  DELETE FROM auth.refresh_tokens
  WHERE user_id = p_user_id;
  
  -- Mettre à jour les sessions utilisateur
  UPDATE user_sessions
  SET logout_at = now()
  WHERE user_id = p_user_id
  AND logout_at IS NULL;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;