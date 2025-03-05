/*
  # Update user passwords

  1. Changes
    - Update password for admin user (theboxoflio@gmail.com)
    - Update password for regular user (liovernay@gmail.com)
  
  Note: This migration safely updates passwords for existing users
*/

-- Update admin user password
UPDATE auth.users
SET encrypted_password = crypt('@Cver1010', gen_salt('bf'))
WHERE email = 'theboxoflio@gmail.com';

-- Update regular user password
UPDATE auth.users
SET encrypted_password = crypt('@Vver0806', gen_salt('bf'))
WHERE email = 'liovernay@gmail.com';