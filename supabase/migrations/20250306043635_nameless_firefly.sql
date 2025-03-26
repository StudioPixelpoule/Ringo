/*
  # Update RLS policies for messages and conversation documents

  1. Changes
    - Add RLS policies for messages table
    - Add RLS policies for conversation_documents table
    - Fix single row select policy for conversation_documents
    - Add safety checks to prevent duplicate policies

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data
    - Ensure users can only access data related to their conversations
*/

-- Enable RLS
DO $$ 
BEGIN
  ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
  ALTER TABLE conversation_documents ENABLE ROW LEVEL SECURITY;
EXCEPTION 
  WHEN others THEN NULL;
END $$;

-- Messages policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can manage messages in their conversations" ON messages;
  
  CREATE POLICY "Users can manage messages in their conversations"
  ON messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );
END $$;

-- Conversation documents policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can manage documents in their conversations" ON conversation_documents;
  
  CREATE POLICY "Users can manage documents in their conversations"
  ON conversation_documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_documents.conversation_id
      AND conversations.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_documents.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );
END $$;

-- Fix single row select for conversation_documents
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can read single conversation document" ON conversation_documents;
  
  CREATE POLICY "Users can read single conversation document"
  ON conversation_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_documents.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );
END $$;