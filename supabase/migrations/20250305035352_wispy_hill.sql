/*
  # Fix RLS Policies

  1. Changes
    - Simplify RLS policies to prevent infinite recursion
    - Use direct role checks instead of nested queries
    - Add efficient caching for admin status

  2. Security
    - Maintain strict access control
    - Preserve admin privileges
    - Keep user data isolation
*/

-- Create admin check function for better performance
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND role = 'admin'
    AND status = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow admin full access" ON profiles;
DROP POLICY IF EXISTS "Allow users to read own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON profiles;

-- Create new optimized policies
CREATE POLICY "admin_full_access"
  ON profiles
  FOR ALL
  TO authenticated
  USING (
    is_admin(auth.uid())
  );

CREATE POLICY "users_read_own"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    AND status = true
  );

CREATE POLICY "users_update_own"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    AND status = true
  )
  WITH CHECK (
    id = auth.uid()
    AND status = true
  );

-- Add index for faster admin checks
CREATE INDEX IF NOT EXISTS idx_profiles_admin_check 
ON profiles (id, role, status) 
WHERE role = 'admin' AND status = true;