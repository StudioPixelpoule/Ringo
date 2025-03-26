/*
  # User Invitations System

  1. New Tables
    - `user_invitations`
      - `id` (uuid, primary key)
      - `email` (text, with email validation)
      - `role` (text, with role validation)
      - `token` (text, unique)
      - `invited_by` (uuid, references auth.users)
      - `expires_at` (timestamptz)
      - `created_at` (timestamptz)
      - `accepted_at` (timestamptz)
      - `status` (text, with status validation)

  2. Functions
    - `generate_invitation_token()`: Generates secure tokens
    - `validate_invitation_token()`: Validates invitation tokens
    - `accept_invitation()`: Handles invitation acceptance
    - `cleanup_expired_invitations()`: Cleans up expired invitations

  3. Security
    - Enable RLS
    - Add policies for super admins and admins
*/

-- Create user_invitations table
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

-- Enable RLS
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- Create indexes (with existence checks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_user_invitations_email'
  ) THEN
    CREATE INDEX idx_user_invitations_email ON user_invitations(email);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_user_invitations_token'
  ) THEN
    CREATE INDEX idx_user_invitations_token ON user_invitations(token);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_user_invitations_status'
  ) THEN
    CREATE INDEX idx_user_invitations_status ON user_invitations(status);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_user_invitations_expires'
  ) THEN
    CREATE INDEX idx_user_invitations_expires ON user_invitations(expires_at);
  END IF;
END
$$;

-- Create function to generate secure token
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  token text;
BEGIN
  token := encode(gen_random_bytes(32), 'hex');
  RETURN token;
END;
$$;

-- Create function to validate invitation token
CREATE OR REPLACE FUNCTION validate_invitation_token(token_to_check text)
RETURNS TABLE (
  is_valid boolean,
  email text,
  role text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN i.status = 'pending' 
        AND i.expires_at > now() 
      THEN true 
      ELSE false 
    END as is_valid,
    i.email,
    i.role
  FROM user_invitations i
  WHERE i.token = token_to_check
  LIMIT 1;
END;
$$;

-- Create function to handle invitation acceptance
CREATE OR REPLACE FUNCTION accept_invitation(token_to_accept text, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE user_invitations
  SET 
    status = 'accepted',
    accepted_at = now()
  WHERE 
    token = token_to_accept
    AND status = 'pending'
    AND expires_at > now();

  RETURN FOUND;
END;
$$;

-- Create function to cleanup expired invitations
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE user_invitations
  SET status = 'expired'
  WHERE 
    status = 'pending'
    AND expires_at < now();
END;
$$;

-- Create trigger for automatic cleanup
CREATE OR REPLACE FUNCTION trigger_invitation_cleanup()
RETURNS trigger AS $$
BEGIN
  IF EXTRACT(minute FROM CURRENT_TIMESTAMP) = 0 THEN
    PERFORM cleanup_expired_invitations();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS hourly_invitation_cleanup ON user_invitations;
CREATE TRIGGER hourly_invitation_cleanup
  AFTER INSERT ON user_invitations
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_invitation_cleanup();

-- Drop existing policies if any
DROP POLICY IF EXISTS "Super admins can manage all invitations" ON user_invitations;
DROP POLICY IF EXISTS "Admins can view invitations" ON user_invitations;

-- Create RLS policies
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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION generate_invitation_token TO authenticated;
GRANT EXECUTE ON FUNCTION validate_invitation_token TO authenticated;
GRANT EXECUTE ON FUNCTION accept_invitation TO authenticated;

-- Add comment
COMMENT ON TABLE user_invitations IS 'Stores pending user invitations with secure tokens and expiration dates.';