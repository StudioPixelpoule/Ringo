/*
  # Fix Session Activity Trigger

  1. Changes
    - Drop existing trigger safely
    - Recreate session activity trigger
    - Add session management functions
    - Add security policies
  
  2. Security
    - Maintain existing security model
    - Keep user session tracking
    - Preserve audit capabilities
*/

-- Drop existing trigger safely
DROP TRIGGER IF EXISTS session_activity_update ON active_sessions;

-- Recreate session activity function
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS trigger AS $$
BEGIN
  NEW.last_active_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create new trigger with unique name
CREATE TRIGGER update_sessions_activity
  BEFORE UPDATE ON active_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

-- Add session management functions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM active_sessions
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add session validation function
CREATE OR REPLACE FUNCTION validate_session(
  p_session_id uuid,
  p_user_id uuid
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM active_sessions
    WHERE id = p_session_id
    AND user_id = p_user_id
    AND expires_at > now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add session cleanup trigger
CREATE OR REPLACE FUNCTION trigger_session_cleanup()
RETURNS trigger AS $$
BEGIN
  -- Clean expired sessions hourly
  IF EXTRACT(minute FROM CURRENT_TIMESTAMP) = 0 THEN
    PERFORM cleanup_expired_sessions();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create hourly cleanup trigger
DROP TRIGGER IF EXISTS hourly_session_cleanup ON active_sessions;
CREATE TRIGGER hourly_session_cleanup
  AFTER INSERT ON active_sessions
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_session_cleanup();

-- Update session policies
DROP POLICY IF EXISTS "Users can view own sessions" ON active_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON active_sessions;

CREATE POLICY "Users can view own sessions"
  ON active_sessions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND expires_at > now()
  );

CREATE POLICY "Users can delete own sessions"
  ON active_sessions
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
  );

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_expires 
ON active_sessions(user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_active_sessions_last_active 
ON active_sessions(last_active_at);