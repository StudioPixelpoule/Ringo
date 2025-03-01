-- Drop the auth_users view and dependent objects with CASCADE
DROP VIEW IF EXISTS auth_users CASCADE;

-- Create a secure view to access auth.users safely
CREATE OR REPLACE VIEW auth_users AS
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at,
  raw_user_meta_data,
  email_confirmed_at,
  is_sso_user,
  banned_until
FROM auth.users;

-- Create a secure function to get auth users data
CREATE OR REPLACE FUNCTION get_auth_users()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  raw_user_meta_data jsonb,
  email_confirmed_at timestamptz,
  is_sso_user boolean,
  banned_until timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    email,
    created_at,
    last_sign_in_at,
    raw_user_meta_data,
    email_confirmed_at,
    is_sso_user,
    banned_until
  FROM auth.users
  WHERE EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ) OR id = auth.uid();
$$;

-- Create a function to get a specific user by ID
CREATE OR REPLACE FUNCTION get_auth_user_by_id(user_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  raw_user_meta_data jsonb,
  email_confirmed_at timestamptz,
  is_sso_user boolean,
  banned_until timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    email,
    created_at,
    last_sign_in_at,
    raw_user_meta_data,
    email_confirmed_at,
    is_sso_user,
    banned_until
  FROM auth.users
  WHERE id = user_id
  AND (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    ) OR user_id = auth.uid()
  );
$$;

-- Grant usage permissions
GRANT EXECUTE ON FUNCTION get_auth_users() TO authenticated;
GRANT EXECUTE ON FUNCTION get_auth_users() TO service_role;
GRANT EXECUTE ON FUNCTION get_auth_user_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_auth_user_by_id(uuid) TO service_role;