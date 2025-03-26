-- Update role check in profiles table
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'g_admin', 'admin', 'user'));

-- Create initial users if they don't exist
DO $$ 
BEGIN
  -- Create super admin (theboxoflio@gmail.com)
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'theboxoflio@gmail.com'
  ) THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token,
      is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'theboxoflio@gmail.com',
      crypt('@Cver1010', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"role":"super_admin"}',
      now(),
      now(),
      '',
      '',
      '',
      '',
      true
    );
  END IF;

  -- Create admin (jsb@enmodesolutions.com)
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'jsb@enmodesolutions.com'
  ) THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token,
      is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'jsb@enmodesolutions.com',
      crypt('@Jsb2024', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"role":"admin"}',
      now(),
      now(),
      '',
      '',
      '',
      '',
      false
    );
  END IF;

  -- Create regular user (liovernay@gmail.com)
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'liovernay@gmail.com'
  ) THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token,
      is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'liovernay@gmail.com',
      crypt('@Vver0806', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"role":"user"}',
      now(),
      now(),
      '',
      '',
      '',
      '',
      false
    );
  END IF;
END $$;

-- Update profiles for existing users
DO $$
BEGIN
  -- Update theboxoflio@gmail.com to super_admin
  UPDATE profiles
  SET role = 'super_admin',
      status = true
  WHERE email = 'theboxoflio@gmail.com';

  -- Update jsb@enmodesolutions.com to admin
  UPDATE profiles
  SET role = 'admin',
      status = true
  WHERE email = 'jsb@enmodesolutions.com';

  -- Update liovernay@gmail.com to user
  UPDATE profiles
  SET role = 'user',
      status = true
  WHERE email = 'liovernay@gmail.com';
END $$;

-- Create or update indexes for role checks
CREATE INDEX IF NOT EXISTS idx_profiles_super_admin_check
ON profiles (id, role, status) 
WHERE role = 'super_admin' AND status = true;

CREATE INDEX IF NOT EXISTS idx_profiles_admin_check
ON profiles (id, role, status) 
WHERE role = 'admin' AND status = true;

CREATE INDEX IF NOT EXISTS idx_profiles_g_admin_check
ON profiles (id, role, status) 
WHERE role = 'g_admin' AND status = true;

CREATE INDEX IF NOT EXISTS idx_profiles_user_check
ON profiles (id, status) 
WHERE status = true;

-- Update handle_new_user function to support new roles
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
    CASE
      WHEN NEW.email = 'theboxoflio@gmail.com' THEN 'super_admin'
      WHEN NEW.email = 'jsb@enmodesolutions.com' THEN 'admin'
      ELSE COALESCE(NEW.raw_user_meta_data->>'role', 'user')
    END,
    true,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;