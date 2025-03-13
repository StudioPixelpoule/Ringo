/*
  # Add Row Level Security Policies

  1. Changes
    - Enable RLS on all tables
    - Add policies for user access
    - Add policies for admin access
    - Add function for admin checks

  2. Security
    - Users can only access their own data
    - Admins have full access to all data
    - Proper checks for active status
*/

-- Function to check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND role = 'admin'
    AND status = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DO $$ 
BEGIN
  -- Profiles
  DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
  DROP POLICY IF EXISTS "Admins can do anything" ON profiles;
  
  -- Folders
  DROP POLICY IF EXISTS "Users can read folders" ON folders;
  DROP POLICY IF EXISTS "Admins can manage folders" ON folders;
  
  -- Documents
  DROP POLICY IF EXISTS "Users can read documents" ON documents;
  DROP POLICY IF EXISTS "Admins can manage documents" ON documents;
  
  -- Document contents
  DROP POLICY IF EXISTS "Users can read document contents" ON document_contents;
  DROP POLICY IF EXISTS "Admins can manage document contents" ON document_contents;
  
  -- Conversations
  DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
  DROP POLICY IF EXISTS "Admins can view all conversations" ON conversations;
  
  -- Messages
  DROP POLICY IF EXISTS "Users can manage conversation messages" ON messages;
  DROP POLICY IF EXISTS "Admins can view all messages" ON messages;
  
  -- Conversation documents
  DROP POLICY IF EXISTS "Users can manage conversation documents" ON conversation_documents;
  DROP POLICY IF EXISTS "Admins can view all conversation documents" ON conversation_documents;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  USING (
    auth.uid() = id 
    AND status = true
  );

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (
    auth.uid() = id 
    AND status = true
  )
  WITH CHECK (
    auth.uid() = id 
    AND status = true
  );

CREATE POLICY "Admins can do anything"
  ON profiles
  FOR ALL
  USING (is_admin(auth.uid()));

-- Folders policies
CREATE POLICY "Users can read folders"
  ON folders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Admins can manage folders"
  ON folders
  FOR ALL
  USING (is_admin(auth.uid()));

-- Documents policies
CREATE POLICY "Users can read documents"
  ON documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Admins can manage documents"
  ON documents
  FOR ALL
  USING (is_admin(auth.uid()));

-- Document contents policies
CREATE POLICY "Users can read document contents"
  ON document_contents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Admins can manage document contents"
  ON document_contents
  FOR ALL
  USING (is_admin(auth.uid()));

-- Conversations policies
CREATE POLICY "Users can manage own conversations"
  ON conversations
  FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND status = true
    )
  );

CREATE POLICY "Admins can view all conversations"
  ON conversations
  FOR ALL
  USING (is_admin(auth.uid()));

-- Messages policies
CREATE POLICY "Users can manage conversation messages"
  ON messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
      AND conversations.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND status = true
      )
    )
  );

CREATE POLICY "Admins can view all messages"
  ON messages
  FOR ALL
  USING (is_admin(auth.uid()));

-- Conversation documents policies
CREATE POLICY "Users can manage conversation documents"
  ON conversation_documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
      AND conversations.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND status = true
      )
    )
  );

CREATE POLICY "Admins can view all conversation documents"
  ON conversation_documents
  FOR ALL
  USING (is_admin(auth.uid()));

-- Add indexes for better policy performance
CREATE INDEX IF NOT EXISTS idx_profiles_admin_check 
ON profiles (id, role, status) 
WHERE role = 'admin' AND status = true;

CREATE INDEX IF NOT EXISTS idx_profiles_user_check
ON profiles (id, status)
WHERE status = true;

CREATE INDEX IF NOT EXISTS idx_conversations_user_check
ON conversations (user_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_check
ON messages (conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversation_documents_conversation_check
ON conversation_documents (conversation_id);