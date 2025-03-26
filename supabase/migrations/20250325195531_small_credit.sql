/*
  # Add G-admin Role

  1. Changes
    - Update role enum in profiles table
    - Update role check functions
    - Update RLS policies
    - Add new role validation
  
  2. Security
    - Maintain existing security model
    - Add proper permissions for G-admin
*/

-- Update role check in profiles table
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'g_admin', 'admin', 'user'));

-- Update admin check function
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND role IN ('super_admin', 'g_admin', 'admin')
    AND status = true
  );
END;
$$;

-- Create G-admin check function
CREATE OR REPLACE FUNCTION is_g_admin(user_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND role = 'g_admin'
    AND status = true
  );
END;
$$;

-- Update user management policies
DROP POLICY IF EXISTS "admin_manage_non_super_admin" ON profiles;
DROP POLICY IF EXISTS "user_update_own" ON profiles;

-- Allow G-admins and admins to manage non-super-admin users
CREATE POLICY "admin_manage_non_super_admin"
  ON profiles
  FOR ALL
  TO authenticated
  USING (
    (is_admin(auth.uid()) AND NOT is_super_admin(auth.uid()) AND role != 'super_admin')
    OR
    (is_g_admin(auth.uid()) AND role NOT IN ('super_admin', 'g_admin'))
  );

-- Users can only update their own profile
CREATE POLICY "user_update_own"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    AND status = true
    AND role NOT IN ('super_admin', 'g_admin')
  )
  WITH CHECK (
    id = auth.uid()
    AND status = true
    AND role NOT IN ('super_admin', 'g_admin')
  );

-- Add index for G-admin checks
CREATE INDEX IF NOT EXISTS idx_profiles_g_admin_check
ON profiles (id, role, status)
WHERE role = 'g_admin' AND status = true;