/*
  # Set admin user

  1. Changes
    - Set theboxoflio@gmail.com as admin in profiles table
*/

-- Update the role to admin for the specified user
UPDATE profiles
SET role = 'admin'
WHERE id IN (
  SELECT id 
  FROM auth.users 
  WHERE email = 'theboxoflio@gmail.com'
);