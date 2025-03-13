/*
  # Add User Feedback System

  1. New Tables
    - `user_feedback`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `content` (text)
      - `created_at` (timestamptz)
      - `read_at` (timestamptz)
      - `status` (text)

  2. Security
    - Enable RLS
    - Add policies for user and admin access
    - Add indexes for performance
*/

-- Create user_feedback table
CREATE TABLE IF NOT EXISTS user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz,
  status text DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
  CONSTRAINT feedback_content_length CHECK (char_length(content) <= 2000)
);

-- Enable RLS
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_user_feedback_user ON user_feedback(user_id);
CREATE INDEX idx_user_feedback_status ON user_feedback(status);
CREATE INDEX idx_user_feedback_unread ON user_feedback(created_at DESC) WHERE status = 'unread';

-- Create policies
CREATE POLICY "Users can create feedback"
  ON user_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Users can view own feedback"
  ON user_feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all feedback"
  ON user_feedback
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));