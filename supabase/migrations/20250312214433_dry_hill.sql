/*
  # Fix RLS Policies for Conversations

  1. Changes
    - Drop existing policies to avoid conflicts
    - Create new policies for conversations, messages, and documents
    - Add user_id check to ensure data isolation
    - Add proper indexes for performance
  
  2. Security
    - Each user can only access their own conversations
    - Messages are restricted to conversation owners
    - Document access is limited to conversation context
*/

-- Drop existing policies to avoid conflicts
DO $$ 
BEGIN
  -- Conversations
  DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
  DROP POLICY IF EXISTS "Users can manage their own conversations" ON conversations;
  DROP POLICY IF EXISTS "Admins can view all conversations" ON conversations;
  
  -- Messages
  DROP POLICY IF EXISTS "Users can manage messages in their conversations" ON messages;
  DROP POLICY IF EXISTS "Users can manage conversation messages" ON messages;
  DROP POLICY IF EXISTS "Admins can view all messages" ON messages;
  
  -- Conversation documents
  DROP POLICY IF EXISTS "Users can manage documents in their conversations" ON conversation_documents;
  DROP POLICY IF EXISTS "Users can manage conversation documents" ON conversation_documents;
  DROP POLICY IF EXISTS "Admins can view all conversation documents" ON conversation_documents;
  DROP POLICY IF EXISTS "Users can read single conversation document" ON conversation_documents;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create function to check user access if it doesn't exist
CREATE OR REPLACE FUNCTION check_user_access(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND status = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new policies for conversations
CREATE POLICY "Chaque utilisateur voit uniquement ses propres conversations" 
ON conversations FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Chaque utilisateur peut insérer ses propres conversations" 
ON conversations FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Chaque utilisateur peut modifier uniquement ses conversations" 
ON conversations FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Chaque utilisateur peut supprimer uniquement ses conversations" 
ON conversations FOR DELETE 
USING (auth.uid() = user_id);

-- Create new policies for messages
CREATE POLICY "Chaque utilisateur voit les messages de ses conversations" 
ON messages FOR SELECT 
USING (
  conversation_id IN (
    SELECT id FROM conversations WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Chaque utilisateur peut ajouter des messages à ses conversations" 
ON messages FOR INSERT 
WITH CHECK (
  conversation_id IN (
    SELECT id FROM conversations WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Chaque utilisateur peut modifier les messages de ses conversations" 
ON messages FOR UPDATE 
USING (
  conversation_id IN (
    SELECT id FROM conversations WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Chaque utilisateur peut supprimer les messages de ses conversations" 
ON messages FOR DELETE 
USING (
  conversation_id IN (
    SELECT id FROM conversations WHERE user_id = auth.uid()
  )
);

-- Create new policies for conversation documents
CREATE POLICY "Chaque utilisateur voit les documents de ses conversations" 
ON conversation_documents FOR SELECT 
USING (
  conversation_id IN (
    SELECT id FROM conversations WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Chaque utilisateur peut lier des documents à ses conversations" 
ON conversation_documents FOR INSERT 
WITH CHECK (
  conversation_id IN (
    SELECT id FROM conversations WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Chaque utilisateur peut délier des documents de ses conversations" 
ON conversation_documents FOR DELETE 
USING (
  conversation_id IN (
    SELECT id FROM conversations WHERE user_id = auth.uid()
  )
);

-- Add indexes for better performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_conversations_user_check 
ON conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_check
ON messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversation_documents_conversation_check
ON conversation_documents(conversation_id);