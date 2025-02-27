/*
  # Create conversations and messages tables

  1. New Tables
    - `conversations`
      - `id` (uuid, primary key)
      - `title` (text)
      - `user_id` (uuid, foreign key to auth.users)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    - `messages`
      - `id` (uuid, primary key)
      - `role` (text)
      - `content` (text)
      - `conversation_id` (uuid, foreign key to conversations)
      - `created_at` (timestamp)
  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own conversations and messages
*/

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  content text NOT NULL,
  conversation_id uuid REFERENCES conversations ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policies for conversations
CREATE POLICY "Users can create their own conversations"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own conversations"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON conversations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON conversations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for messages
CREATE POLICY "Users can create messages in their conversations"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view messages in their conversations"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages in their conversations"
  ON messages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at on conversations
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();