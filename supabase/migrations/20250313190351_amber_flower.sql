/*
  # Add Super Admin Role

  1. Changes
    - Add super_admin role to profiles
    - Add super admin check function
    - Update RLS policies
    - Add initial super admin user
    - Add super admin specific functions

  2. Security
    - Only super admins can create/modify other super admins
    - Super admins have full access to all data
    - Super admins can manage all users including admins
*/

-- Modify profiles table to support super admin role
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'user'));

-- Create super admin check function
CREATE OR REPLACE FUNCTION is_super_admin(user_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
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

-- Update existing admin check function to include super admins
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
    AND (role = 'admin' OR role = 'super_admin')
    AND status = true
  );
END;
$$;

-- Create function to handle new users with super admin support
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  default_role text;
BEGIN
  -- Determine role based on email
  default_role := CASE 
    WHEN NEW.email = 'theboxoflio@gmail.com' THEN 'super_admin'
    WHEN NEW.email = 'jsb@enmodesolutions.com' THEN 'admin'
    ELSE COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  END;

  -- Create profile
  INSERT INTO public.profiles (
    id,
    email,
    role,
    status,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    default_role,
    true,
    NOW(),
    NOW()
  );

  RETURN NEW;
END;
$$;

-- Update existing users
UPDATE profiles
SET role = 'super_admin'
WHERE email = 'theboxoflio@gmail.com';

-- Create index for super admin checks
CREATE INDEX IF NOT EXISTS idx_profiles_super_admin_check
ON profiles (id, role, status) 
WHERE role = 'super_admin' AND status = true;

-- Update RLS policies for profiles
DROP POLICY IF EXISTS "admin_full_access_policy" ON profiles;
DROP POLICY IF EXISTS "user_read_own_policy" ON profiles;
DROP POLICY IF EXISTS "user_update_own_policy" ON profiles;

-- Create new policies with super admin support
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

-- Create super admin specific functions
CREATE OR REPLACE FUNCTION promote_to_super_admin(target_user_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can promote users to super admin';
  END IF;

  UPDATE profiles
  SET role = 'super_admin'
  WHERE id = target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION revoke_super_admin(target_user_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can revoke super admin privileges';
  END IF;

  -- Prevent revoking the last super admin
  IF (
    SELECT COUNT(*)
    FROM profiles
    WHERE role = 'super_admin'
    AND status = true
  ) <= 1 THEN
    RAISE EXCEPTION 'Cannot revoke the last super admin';
  END IF;

  UPDATE profiles
  SET role = 'admin'
  WHERE id = target_user_id
  AND role = 'super_admin';
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION is_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION promote_to_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_super_admin TO authenticated;