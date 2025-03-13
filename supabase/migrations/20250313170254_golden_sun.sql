/*
  # Fix Authentication System

  1. Changes
    - Fix user creation trigger
    - Update profile defaults and constraints
    - Add proper indexes for auth checks
    - Update RLS policies
  
  2. Security
    - Ensure proper user creation
    - Maintain data isolation
    - Keep admin privileges
*/

-- Drop existing auth-related objects
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS is_admin();

-- Create improved user handler function
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
    WHEN NEW.email = 'theboxoflio@gmail.com' THEN 'admin'
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

-- Create admin check function
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
    AND role = 'admin'
    AND status = true
  );
END;
$$;

-- Create trigger for user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Fix profiles table
ALTER TABLE profiles
ALTER COLUMN status SET DEFAULT true,
ALTER COLUMN role SET DEFAULT 'user',
ALTER COLUMN email SET NOT NULL;

-- Add role validation
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check,
ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'user'));

-- Add unique email constraint if not exists
DO $$ 
BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_profiles_auth_check 
ON profiles (id, role, status);

CREATE INDEX IF NOT EXISTS idx_profiles_active_users
ON profiles (id, status) 
WHERE status = true;

CREATE INDEX IF NOT EXISTS idx_profiles_admin_check
ON profiles (id, role, status) 
WHERE role = 'admin' AND status = true;

CREATE INDEX IF NOT EXISTS idx_profiles_email_role_status
ON profiles (email, role, status);

-- Update existing users
UPDATE profiles
SET status = true,
    role = CASE 
      WHEN email = 'theboxoflio@gmail.com' THEN 'admin'
      WHEN email = 'jsb@enmodesolutions.com' THEN 'admin'
      ELSE role
    END
WHERE email IN ('theboxoflio@gmail.com', 'jsb@enmodesolutions.com');

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "admin_access_policy" ON profiles;
  DROP POLICY IF EXISTS "user_read_policy" ON profiles;
  DROP POLICY IF EXISTS "user_update_policy" ON profiles;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new policies
CREATE POLICY "admin_full_access_policy"
  ON profiles
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "user_read_own_policy"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() 
    AND status = true
  );

CREATE POLICY "user_update_own_policy"
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

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;