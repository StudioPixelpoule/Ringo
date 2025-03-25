-- Add user_id to conversations if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE conversations ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL;
  END IF;
END $$;

-- Create or replace function to check user access
CREATE OR REPLACE FUNCTION check_user_access(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = user_id
      AND status = true
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
  DROP POLICY IF EXISTS "Users can manage messages in their conversations" ON messages;
  DROP POLICY IF EXISTS "Users can manage documents in their conversations" ON conversation_documents;
  DROP POLICY IF EXISTS "Admins can view all conversations" ON conversations;
  DROP POLICY IF EXISTS "Admins can view all messages" ON messages;
  DROP POLICY IF EXISTS "Admins can view all conversation documents" ON conversation_documents;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new policies for conversations
CREATE POLICY "Users can manage own conversations"
  ON conversations
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    AND check_user_access(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND check_user_access(auth.uid())
  );

-- Create new policies for messages
CREATE POLICY "Users can manage messages in their conversations"
  ON messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
      AND conversations.user_id = auth.uid()
      AND check_user_access(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
      AND conversations.user_id = auth.uid()
      AND check_user_access(auth.uid())
    )
  );

-- Create new policies for conversation documents
CREATE POLICY "Users can manage documents in their conversations"
  ON conversation_documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
      AND conversations.user_id = auth.uid()
      AND check_user_access(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
      AND conversations.user_id = auth.uid()
      AND check_user_access(auth.uid())
    )
  );

-- Add admin policies
CREATE POLICY "Admins can view all conversations"
  ON conversations
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can view all messages"
  ON messages
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can view all conversation documents"
  ON conversation_documents
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_documents_conversation_id ON conversation_documents(conversation_id);

-- Add cascade delete triggers
CREATE OR REPLACE FUNCTION delete_user_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all conversations and related data
  DELETE FROM conversations WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_deleted ON auth.users;
CREATE TRIGGER on_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION delete_user_data();

-- Add function to check conversation ownership
CREATE OR REPLACE FUNCTION check_conversation_ownership(conversation_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_id
    AND c.user_id = user_id
    AND check_user_access(user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to get user conversations
CREATE OR REPLACE FUNCTION get_user_conversations(user_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  created_at timestamptz,
  message_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.title,
    c.created_at,
    COUNT(m.id)::bigint as message_count
  FROM conversations c
  LEFT JOIN messages m ON m.conversation_id = c.id
  WHERE c.user_id = user_id
  AND check_user_access(user_id)
  GROUP BY c.id, c.title, c.created_at
  ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;