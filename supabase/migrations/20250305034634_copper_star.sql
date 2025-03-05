/*
  # Add status column to profiles table

  1. Changes
    - Add `status` column to `profiles` table (boolean, default true)
    - Update RLS policies to include status checks
    - Add policy for admins to manage all profiles

  2. Security
    - Only active users can access their profiles
    - Admins can access and modify all profiles
*/

-- Add status column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status boolean DEFAULT true;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create new policies
-- Allow users to read their own profile if active
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = id AND status = true) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND status = true
    )
  );

-- Allow users to update their own profile if active
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = id AND status = true) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND status = true
    )
  )
  WITH CHECK (
    (auth.uid() = id AND status = true) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND status = true
    )
  );

-- Update existing users to be active by default
UPDATE profiles SET status = true WHERE status IS NULL;