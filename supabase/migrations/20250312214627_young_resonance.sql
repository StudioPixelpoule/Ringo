/*
  # Security and Authentication System

  1. New Tables
    - `auth_attempts` - Track login attempts
    - `active_sessions` - Manage user sessions
    - `security_notifications` - Store security alerts
  
  2. Security
    - Enable RLS on all tables
    - Add policies for access control
    - Add validation functions
*/

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text NOT NULL,
  user_agent text,
  attempted_at timestamptz DEFAULT now(),
  success boolean NOT NULL,
  failure_reason text
);

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

CREATE TABLE IF NOT EXISTS security_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz,
  metadata jsonb
);

-- Enable RLS
ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_notifications ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_auth_attempts_email ON auth_attempts(email);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip ON auth_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_timestamp ON auth_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires ON active_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_security_notifications_user ON security_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_security_notifications_unread ON security_notifications(user_id) WHERE read_at IS NULL;

-- Create functions
CREATE OR REPLACE FUNCTION check_login_attempts(p_email text, p_ip text)
RETURNS boolean AS $$
DECLARE
  attempt_count int;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM auth_attempts
  WHERE email = p_email 
    AND ip_address = p_ip
    AND success = false
    AND attempted_at > now() - interval '15 minutes';
  RETURN attempt_count < 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_auth_data()
RETURNS trigger AS $$
BEGIN
  -- Clean old login attempts
  DELETE FROM auth_attempts
  WHERE attempted_at < now() - interval '24 hours';
  
  -- Clean expired sessions
  DELETE FROM active_sessions
  WHERE expires_at < now();
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS trigger AS $$
BEGIN
  NEW.last_active_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS hourly_cleanup ON auth_attempts;
CREATE TRIGGER hourly_cleanup
  AFTER INSERT ON auth_attempts
  FOR EACH STATEMENT
  WHEN (EXTRACT(minute FROM CURRENT_TIMESTAMP) = 0)
  EXECUTE FUNCTION cleanup_auth_data();

DROP TRIGGER IF EXISTS session_activity_update ON active_sessions;
CREATE TRIGGER session_activity_update
  BEFORE UPDATE ON active_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

-- Drop existing policies to avoid conflicts
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can view auth attempts" ON auth_attempts;
  DROP POLICY IF EXISTS "Users can view own sessions" ON active_sessions;
  DROP POLICY IF EXISTS "Users can delete own sessions" ON active_sessions;
  DROP POLICY IF EXISTS "Users can view own notifications" ON security_notifications;
  DROP POLICY IF EXISTS "Users can update own notifications" ON security_notifications;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create RLS policies
CREATE POLICY "Only admins can access auth attempts"
  ON auth_attempts
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "View own sessions"
  ON active_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Delete own sessions"
  ON active_sessions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "View own notifications"
  ON security_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Update own notifications"
  ON security_notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add email validation functions
CREATE OR REPLACE FUNCTION is_valid_email(email text)
RETURNS boolean AS $$
BEGIN
  RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION is_disposable_email(email text)
RETURNS boolean AS $$
BEGIN
  RETURN email ~* '@(temp-mail\.|tempmail\.|throwaway\.|disposable\.)';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add constraints to auth.users if they don't exist
DO $$ 
BEGIN
  ALTER TABLE auth.users
    ADD CONSTRAINT password_strength 
    CHECK (
      CASE 
        WHEN encrypted_password IS NOT NULL THEN
          length(encrypted_password) >= 60
        ELSE true
      END
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER TABLE auth.users
    ADD CONSTRAINT valid_email
    CHECK (is_valid_email(email));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER TABLE auth.users
    ADD CONSTRAINT no_disposable_email
    CHECK (NOT is_disposable_email(email));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;