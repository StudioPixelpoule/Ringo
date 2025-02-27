/*
  # Update conversations and messages tables

  This migration checks if tables and policies already exist before creating them.
  
  1. Tables
    - `conversations` (if not exists)
    - `messages` (if not exists)
  
  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own conversations and messages
*/

-- Create conversations table if it doesn't exist
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  content text NOT NULL,
  conversation_id uuid REFERENCES conversations ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security if not already enabled
DO $$ 
BEGIN
  EXECUTE format('ALTER TABLE conversations ENABLE ROW LEVEL SECURITY');
  EXECUTE format('ALTER TABLE messages ENABLE ROW LEVEL SECURITY');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Drop existing policies to avoid conflicts
DO $$ 
BEGIN
  -- Drop policies for conversations if they exist
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Users can create their own conversations') THEN
    DROP POLICY "Users can create their own conversations" ON conversations;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Users can view their own conversations') THEN
    DROP POLICY "Users can view their own conversations" ON conversations;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Users can update their own conversations') THEN
    DROP POLICY "Users can update their own conversations" ON conversations;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Users can delete their own conversations') THEN
    DROP POLICY "Users can delete their own conversations" ON conversations;
  END IF;
  
  -- Drop policies for messages if they exist
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can create messages in their conversations') THEN
    DROP POLICY "Users can create messages in their conversations" ON messages;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can view messages in their conversations') THEN
    DROP POLICY "Users can view messages in their conversations" ON messages;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can delete messages in their conversations') THEN
    DROP POLICY "Users can delete messages in their conversations" ON messages;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Create policies for conversations
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

-- Create policies for messages
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

-- Create function to update updated_at timestamp if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at on conversations if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_conversations_updated_at') THEN
    CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;