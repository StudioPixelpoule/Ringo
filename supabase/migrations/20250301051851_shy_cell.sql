-- Create a view to access auth.users safely
CREATE OR REPLACE VIEW auth_users AS
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at,
  raw_user_meta_data
FROM auth.users;

-- Create a secure wrapper function to access auth users data
-- This function will respect RLS policies defined at the application level
CREATE OR REPLACE FUNCTION get_auth_users()
RETURNS SETOF auth_users
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM auth_users
  WHERE EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ) OR id = auth.uid();
$$;

-- Grant usage permissions
GRANT EXECUTE ON FUNCTION get_auth_users() TO authenticated;
GRANT EXECUTE ON FUNCTION get_auth_users() TO service_role;

-- Create a function to get a specific user by ID
CREATE OR REPLACE FUNCTION get_auth_user_by_id(user_id uuid)
RETURNS auth_users
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM auth_users
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
GRANT EXECUTE ON FUNCTION get_auth_user_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_auth_user_by_id(uuid) TO service_role;