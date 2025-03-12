/*
  # Fix Messages RLS Policies

  1. Security Changes
    - Enable RLS on messages table
    - Add policy for authenticated users to manage their own messages
    - Users can only manage messages in conversations they own
*/

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Users can manage messages in their conversations" ON messages;

-- Create policy for managing messages
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