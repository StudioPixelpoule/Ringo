/*
  # Add password_changed column to profiles table

  1. Changes
    - Add password_changed boolean column to profiles table
    - Set default value to false
    - Allow null values
    - Add index for better query performance
  
  2. Security
    - Maintain existing RLS policies
    - Keep proper access control
*/

-- Add password_changed column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS password_changed boolean DEFAULT false;

-- Create index for password_changed column
CREATE INDEX IF NOT EXISTS idx_profiles_password_changed 
ON profiles(password_changed) 
WHERE password_changed = false;

-- Update existing users to have password_changed = true
UPDATE profiles 
SET password_changed = true 
WHERE email IN ('theboxoflio@gmail.com', 'jsb@enmodesolutions.com');

-- Add comment
COMMENT ON COLUMN profiles.password_changed IS 'Indicates if user has changed their password from the default one';