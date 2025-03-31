/*
  # Fix Super Admin RLS Policies

  1. Changes
    - Drop existing policies
    - Create new super admin policies with proper access
    - Add role-specific policies
    - Add performance indexes
  
  2. Security
    - Super admins have full access to all operations
    - Admins can manage non-super-admin users
    - Users can only access their own profiles
*/

-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "admin_full_access_policy" ON profiles;
  DROP POLICY IF EXISTS "user_read_own_policy" ON profiles;
  DROP POLICY IF EXISTS "user_update_own_policy" ON profiles;
  DROP POLICY IF EXISTS "admin_manage_non_super_admin" ON profiles;
  DROP POLICY IF EXISTS "super_admin_full_access" ON profiles;
  DROP POLICY IF EXISTS "user_read_own" ON profiles;
  DROP POLICY IF EXISTS "user_update_own" ON profiles;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create function to check if user is super admin
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

-- Create function to check if user is admin
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

-- Create new policies with proper super admin access
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_admin_check 
ON profiles (id, role, status) 
WHERE role = 'admin' AND status = true;

CREATE INDEX IF NOT EXISTS idx_profiles_super_admin_check
ON profiles (id, role, status) 
WHERE role = 'super_admin' AND status = true;

CREATE INDEX IF NOT EXISTS idx_profiles_user_check
ON profiles (id, status) 
WHERE status = true;

CREATE INDEX IF NOT EXISTS idx_profiles_auth_check
ON profiles (id, role, status);

CREATE INDEX IF NOT EXISTS idx_profiles_email_role_status
ON profiles (email, role, status);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION is_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;

-- Add comments
COMMENT ON FUNCTION is_super_admin IS 'Checks if a user has super admin privileges';
COMMENT ON FUNCTION is_admin IS 'Checks if a user has admin privileges (includes super admins)';