/*
  # Ensure admin profile exists

  1. Changes
    - Insert admin profile if it doesn't exist
    - Update role to admin for theboxoflio@gmail.com if profile exists
*/

DO $$
BEGIN
  -- Insert admin profile if it doesn't exist
  INSERT INTO profiles (id, role)
  SELECT id, 'admin'
  FROM auth.users
  WHERE email = 'theboxoflio@gmail.com'
  ON CONFLICT (id) DO UPDATE
  SET role = 'admin';
END $$;