/*
  # Fix User Management and RLS Policies

  1. Changes
    - Update profile defaults and constraints
    - Fix user creation trigger
    - Update indexes for performance
    - Fix RLS policies without conflicts
  
  2. Security
    - Maintain existing security model
    - Keep user data isolation
    - Preserve admin privileges
*/

-- Fix profiles table constraints and defaults
ALTER TABLE profiles
ALTER COLUMN status SET DEFAULT true,
ALTER COLUMN role SET DEFAULT 'user';

-- Add validation for role values
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check,
ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'user'));

-- Create or replace function to handle new users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
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
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::text,
      CASE
        WHEN NEW.email = 'theboxoflio@gmail.com' THEN 'admin'
        WHEN NEW.email = 'jsb@enmodesolutions.com' THEN 'admin'
        ELSE 'user'
      END
    ),
    true,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_email_role_status 
ON profiles(email, role, status);

CREATE INDEX IF NOT EXISTS idx_profiles_active_users
ON profiles(id, status)
WHERE status = true;

-- Update existing users to ensure proper status
UPDATE profiles
SET status = true
WHERE email IN ('theboxoflio@gmail.com', 'jsb@enmodesolutions.com')
AND status IS NOT true;

-- Ensure proper RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Update RLS policies
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND role = 'admin'
    AND status = true
  );
END;
$$;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "admin_full_access" ON profiles;
  DROP POLICY IF EXISTS "users_read_own" ON profiles;
  DROP POLICY IF EXISTS "users_update_own" ON profiles;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new policies with unique names
CREATE POLICY "admin_access_policy"
  ON profiles
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "user_read_policy"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() 
    AND status = true
  );

CREATE POLICY "user_update_policy"
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