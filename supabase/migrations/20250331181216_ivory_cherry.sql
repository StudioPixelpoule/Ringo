/*
  # Migration consolidée de la base de données

  1. Structure
    - Tables de base (users, profiles, auth_settings)
    - Gestion des documents (folders, documents, document_contents)
    - Conversations et messages
    - Rapports et templates
    - Système de feedback
    - Journalisation et sécurité

  2. Sécurité
    - Fonctions d'autorisation
    - Politiques RLS
    - Indexes optimisés
    - Triggers de maintenance
*/

-- Disable triggers temporarily for bulk operations
SET session_replication_role = replica;

--[ 1. FUNCTIONS D'AUTORISATION ]--------------------------------------------------

-- Fonction de vérification super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND role = 'super_admin'
    AND status = true
  );
END;
$$;

-- Fonction de vérification admin
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND role IN ('admin', 'super_admin')
    AND status = true
  );
END;
$$;

-- Fonction de vérification d'accès utilisateur
CREATE OR REPLACE FUNCTION check_user_access(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND status = true
  );
END;
$$;

--[ 2. TABLES DE BASE ]---------------------------------------------------------

-- Table des profils utilisateurs
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('super_admin', 'admin', 'user')),
  status boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Table des paramètres d'authentification
CREATE TABLE IF NOT EXISTS auth_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

--[ 3. GESTION DES DOCUMENTS ]--------------------------------------------------

-- Table des dossiers
CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT folder_depth CHECK (parent_id != id)
);

-- Table des documents
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  description text,
  url text,
  size bigint,
  processed boolean DEFAULT false,
  is_chunked boolean DEFAULT false,
  manifest_path text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table du contenu des documents
CREATE TABLE IF NOT EXISTS document_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  is_chunked boolean DEFAULT false,
  chunk_index integer,
  total_chunks integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_chunk_data CHECK (
    (is_chunked = false AND chunk_index IS NULL AND total_chunks IS NULL) OR
    (is_chunked = true AND chunk_index IS NOT NULL AND total_chunks IS NOT NULL)
  )
);

-- Cache des documents
CREATE TABLE IF NOT EXISTS document_cache (
  hash text PRIMARY KEY,
  content text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  is_chunked boolean DEFAULT false,
  manifest_path text,
  cached_at timestamptz DEFAULT now()
);

--[ 4. CONVERSATIONS ET MESSAGES ]----------------------------------------------

-- Table des conversations
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Table des messages
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  sender text NOT NULL CHECK (sender IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Table des documents liés aux conversations
CREATE TABLE IF NOT EXISTS conversation_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id, document_id)
);

--[ 5. SÉCURITÉ ET JOURNALISATION ]--------------------------------------------

-- Table des tentatives d'authentification
CREATE TABLE IF NOT EXISTS auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text NOT NULL,
  user_agent text,
  attempted_at timestamptz DEFAULT now(),
  success boolean NOT NULL,
  failure_reason text
);

-- Table des sessions actives
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

-- Table des notifications de sécurité
CREATE TABLE IF NOT EXISTS security_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz,
  metadata jsonb
);

-- Table des journaux d'erreurs
CREATE TABLE IF NOT EXISTS error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error text NOT NULL,
  stack text,
  context jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'resolved')),
  resolution text,
  archived boolean DEFAULT false,
  CONSTRAINT error_content_length CHECK (char_length(error) <= 10000)
);

--[ 6. FEEDBACK ET INVITATIONS ]-----------------------------------------------

-- Table du feedback utilisateur
CREATE TABLE IF NOT EXISTS user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz,
  status text DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
  CONSTRAINT feedback_content_length CHECK (char_length(content) <= 2000)
);

-- Table des invitations utilisateur
CREATE TABLE IF NOT EXISTS user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('super_admin', 'admin', 'user')),
  token text NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id) NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

--[ 7. VUES MATÉRIALISÉES ]---------------------------------------------------

-- Vue des statistiques de conversation
CREATE MATERIALIZED VIEW conversation_stats AS
SELECT 
  c.id AS conversation_id,
  c.user_id,
  c.title,
  COUNT(DISTINCT m.id) AS message_count,
  COUNT(DISTINCT cd.id) AS document_count,
  MAX(m.created_at) AS last_message_at,
  MIN(m.created_at) AS first_message_at,
  MAX(cd.created_at) AS last_document_at,
  COUNT(DISTINCT m.sender) AS participant_count,
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = c.user_id
    AND p.role = 'admin'
    AND p.status = true
  ) AS is_admin_conversation
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
LEFT JOIN conversation_documents cd ON cd.conversation_id = c.id
WHERE EXISTS (
  SELECT 1 FROM profiles p
  WHERE p.id = c.user_id
  AND p.status = true
)
GROUP BY c.id, c.user_id, c.title;

-- Vue des logs d'erreur avec informations utilisateur
CREATE VIEW error_logs_with_users 
WITH (security_invoker = on)
AS
SELECT 
  e.*,
  p.email as user_email,
  p.role as user_role
FROM error_logs e
LEFT JOIN profiles p ON e.user_id = p.id;

-- Vue du feedback avec profils
CREATE VIEW feedback_with_profiles 
WITH (security_invoker = on)
AS
SELECT 
  f.id,
  f.user_id,
  f.content,
  f.created_at,
  f.read_at,
  f.status,
  p.email
FROM user_feedback f
JOIN profiles p ON f.user_id = p.id;

--[ 8. FONCTIONS IMPORTANTES ]------------------------------------------------

-- Fonction de suppression des données utilisateur
CREATE OR REPLACE FUNCTION delete_user_data_v2(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
  user_role text;
  conversation_count int;
  document_count int;
  feedback_count int;
  error_context jsonb;
BEGIN
  -- Start transaction
  BEGIN
    -- Get user info for logging
    SELECT email, role INTO user_email, user_role
    FROM profiles 
    WHERE id = user_id_param;

    -- Check if user exists
    IF user_email IS NULL THEN
      RAISE EXCEPTION 'User not found';
    END IF;

    -- Check if user is the last super admin
    IF user_role = 'super_admin' THEN
      IF (
        SELECT COUNT(*) 
        FROM profiles 
        WHERE role = 'super_admin' 
        AND status = true
      ) <= 1 THEN
        RAISE EXCEPTION 'Cannot delete the last super admin';
      END IF;
    END IF;

    -- Count data to be deleted for logging
    SELECT COUNT(*) INTO conversation_count
    FROM conversations 
    WHERE user_id = user_id_param;

    SELECT COUNT(*) INTO document_count
    FROM documents d
    INNER JOIN folders f ON d.folder_id = f.id
    WHERE f.id IN (
      SELECT id FROM folders WHERE id = user_id_param
    );

    SELECT COUNT(*) INTO feedback_count
    FROM user_feedback
    WHERE user_id = user_id_param;

    -- Build error context
    error_context := jsonb_build_object(
      'user_id', user_id_param,
      'email', user_email,
      'role', user_role,
      'data_counts', jsonb_build_object(
        'conversations', conversation_count,
        'documents', document_count,
        'feedback', feedback_count
      ),
      'timestamp', now()
    );

    -- Delete user data from all tables in correct order
    DELETE FROM conversation_documents 
    WHERE conversation_id IN (
      SELECT id FROM conversations WHERE user_id = user_id_param
    );
    
    DELETE FROM messages 
    WHERE conversation_id IN (
      SELECT id FROM conversations WHERE user_id = user_id_param
    );
    
    DELETE FROM conversations WHERE user_id = user_id_param;
    DELETE FROM user_feedback WHERE user_id = user_id_param;
    DELETE FROM error_logs WHERE user_id = user_id_param;
    DELETE FROM security_notifications WHERE user_id = user_id_param;
    DELETE FROM active_sessions WHERE user_id = user_id_param;
    DELETE FROM auth_attempts WHERE email = user_email;
    
    -- Delete profile last
    DELETE FROM profiles WHERE id = user_id_param;

    -- Log successful deletion
    INSERT INTO error_logs (
      error,
      context,
      status
    ) VALUES (
      'User deleted successfully',
      error_context || jsonb_build_object('success', true),
      'resolved'
    );

    -- Commit transaction
    COMMIT;
  EXCEPTION WHEN OTHERS THEN
    -- Log error and rollback
    error_context := error_context || jsonb_build_object(
      'error_details', SQLERRM,
      'error_hint', SQLSTATE,
      'success', false
    );

    INSERT INTO error_logs (
      error,
      stack,
      context,
      status
    ) VALUES (
      'Failed to delete user data',
      SQLERRM,
      error_context,
      'new'
    );
    
    -- Rollback transaction
    ROLLBACK;
    RAISE;
  END;
END;
$$;

--[ 9. TRIGGERS ET FONCTIONS DE MAINTENANCE ]----------------------------------

-- Fonction de mise à jour du timestamp updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour la mise à jour des sessions
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_active_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction de nettoyage des invitations expirées
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_invitations
  SET status = 'expired'
  WHERE 
    status = 'pending'
    AND expires_at < now();
END;
$$;

-- Fonction de nettoyage du cache des documents
CREATE OR REPLACE FUNCTION cleanup_document_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM document_cache
  WHERE cached_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Trigger de nettoyage périodique
CREATE OR REPLACE FUNCTION trigger_cleanup()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM cleanup_expired_invitations();
  PERFORM cleanup_document_cache();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

--[ 10. CREATION DES TRIGGERS ]-----------------------------------------------

-- Trigger de mise à jour des timestamps
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_contents_updated_at
  BEFORE UPDATE ON document_contents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger de mise à jour des sessions
CREATE TRIGGER session_activity_update
  BEFORE UPDATE ON active_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

-- Trigger de nettoyage horaire
CREATE TRIGGER hourly_cleanup
  AFTER INSERT ON auth_attempts
  FOR EACH STATEMENT
  WHEN (EXTRACT(minute FROM CURRENT_TIMESTAMP) = 0)
  EXECUTE FUNCTION trigger_cleanup();

--[ 11. POLITIQUES RLS ]-----------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- Politiques pour les profils
CREATE POLICY "super_admin_full_access"
  ON profiles
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "admin_manage_non_super_admin"
  ON profiles
  FOR ALL
  TO authenticated
  USING (
    is_admin(auth.uid()) 
    AND NOT is_super_admin(auth.uid()) 
    AND role != 'super_admin'
  );

CREATE POLICY "user_read_own"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    AND status = true
  );

CREATE POLICY "user_update_own"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    AND status = true
    AND role != 'super_admin'
  )
  WITH CHECK (
    id = auth.uid()
    AND status = true
    AND role != 'super_admin'
  );

-- Politiques pour les dossiers et documents
CREATE POLICY "Users can read and list folders"
  ON folders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Admins can manage folders"
  ON folders
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can read documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Admins can manage documents"
  ON documents
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

-- Politiques pour les conversations
CREATE POLICY "Users can manage own conversations"
  ON conversations
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    AND check_user_access(auth.uid())
  );

CREATE POLICY "Users can manage conversation messages"
  ON messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
      AND conversations.user_id = auth.uid()
      AND check_user_access(auth.uid())
    )
  );

CREATE POLICY "Users can manage conversation documents"
  ON conversation_documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
      AND conversations.user_id = auth.uid()
      AND check_user_access(auth.uid())
    )
  );

-- Politiques pour la sécurité
CREATE POLICY "Only admins can access auth attempts"
  ON auth_attempts
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

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

-- Politiques pour les logs et le feedback
CREATE POLICY "Super admins can access error logs"
  ON error_logs
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can create feedback"
  ON user_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Users can view own feedback"
  ON user_feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all feedback"
  ON user_feedback
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

-- Politiques pour les invitations
CREATE POLICY "Super admins can manage all invitations"
  ON user_invitations
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Admins can view invitations"
  ON user_invitations
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

--[ 12. CONFIGURATION DU STOCKAGE ]-------------------------------------------

-- Ensure storage bucket exists
INSERT INTO storage.buckets (id, name)
VALUES ('documents', 'documents')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create storage policies
CREATE POLICY "Users can read storage objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "Admins can manage storage objects"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND status = true
    )
  );

--[ 13. CONFIGURATION INITIALE ]----------------------------------------------

-- Insert default auth settings
INSERT INTO auth_settings (key, value, description)
VALUES 
  ('otp_expiry_seconds', '3600', 'OTP expiration time in seconds'),
  ('enable_leaked_password_protection', 'true', 'Whether to check for leaked passwords during signup/login')
ON CONFLICT (key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

-- Re-enable triggers
SET session_replication_role = DEFAULT;

--[ 14. VERIFICATION POST-MIGRATION ]-----------------------------------------

DO $$ 
DECLARE
  missing_table text;
  missing_function text;
  missing_policy text;
  table_names text[] := ARRAY[
    'profiles', 'auth_settings', 'folders', 'documents', 'document_contents',
    'document_cache', 'conversations', 'messages', 'conversation_documents',
    'auth_attempts', 'active_sessions', 'security_notifications', 'error_logs',
    'user_feedback', 'user_invitations'
  ];
  function_names text[] := ARRAY[
    'is_super_admin', 'is_admin', 'check_user_access', 'delete_user_data_v2',
    'update_updated_at_column', 'update_session_activity', 'cleanup_expired_invitations',
    'cleanup_document_cache', 'trigger_cleanup'
  ];
BEGIN
  -- Verify tables
  FOR missing_table IN 
    SELECT t.table_name 
    FROM unnest(table_names) AS t(table_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = t.table_name
    )
  LOOP
    RAISE NOTICE 'Missing table: %', missing_table;
  END LOOP;

  -- Verify functions
  FOR missing_function IN 
    SELECT f.function_name 
    FROM unnest(function_names) AS f(function_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = f.function_name
    )
  LOOP
    RAISE NOTICE 'Missing function: %', missing_function;
  END LOOP;

  -- Verify RLS is enabled
  FOR missing_table IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name = ANY(table_names)
    AND NOT EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = table_name 
      AND rowsecurity = true
    )
  LOOP
    RAISE NOTICE 'RLS not enabled on table: %', missing_table;
  END LOOP;

  -- Verify indexes exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND indexname = 'idx_profiles_admin_check'
  ) THEN
    RAISE NOTICE 'Missing critical index: idx_profiles_admin_check';
  END IF;

  -- Verify materialized views
  IF NOT EXISTS (
    SELECT 1 FROM pg_matviews 
    WHERE schemaname = 'public' 
    AND matviewname = 'conversation_stats'
  ) THEN
    RAISE NOTICE 'Missing materialized view: conversation_stats';
  END IF;

  RAISE NOTICE 'Migration verification complete';
END $$;