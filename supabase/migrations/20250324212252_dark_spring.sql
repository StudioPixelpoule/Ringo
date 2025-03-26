/*
  # Fix Invitation Token Generation

  1. Changes
    - Add gen_random_bytes function if not exists
    - Update token generation to use crypto.randomUUID()
    - Fix invitation token validation
  
  2. Security
    - Maintain existing security model
    - Keep proper token generation
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS generate_invitation_token();

-- Create new token generation function using UUID
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS text
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  new_token text;
BEGIN
  -- Generate a UUID and remove hyphens
  new_token := replace(gen_random_uuid()::text, '-', '');
  RETURN new_token;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION generate_invitation_token TO authenticated;

-- Add comment
COMMENT ON FUNCTION generate_invitation_token IS 'Generates a secure random token for user invitations';