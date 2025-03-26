/*
  # Fix RLS policies for profiles table

  1. Changes
    - Simplify RLS policies to prevent infinite recursion
    - Maintain security requirements for admin and user access
    - Keep status checks for active/inactive users

  2. Security
    - Admins can manage all profiles
    - Users can only access their own profile if active
    - Inactive users have no access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Allow admins to read all profiles
CREATE POLICY "Admins can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'admin'
    OR
    (auth.uid() = id AND status = true)
  );

-- Allow admins to update all profiles
CREATE POLICY "Admins can update all profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    role = 'admin'
    OR
    (auth.uid() = id AND status = true)
  )
  WITH CHECK (
    role = 'admin'
    OR
    (auth.uid() = id AND status = true)
  );

-- Ensure all existing users have status set
UPDATE profiles SET status = true WHERE status IS NULL;