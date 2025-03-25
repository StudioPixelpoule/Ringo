/*
  # Fix Conversation Permissions

  1. Changes
    - Grant proper permissions on materialized view
    - Fix RLS policies for conversations
    - Add missing function permissions
    - Ensure proper ownership

  2. Security
    - Maintain data isolation
    - Keep admin access
    - Preserve user permissions
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Chaque utilisateur voit uniquement ses propres conversations" ON conversations;
DROP POLICY IF EXISTS "Chaque utilisateur peut insérer ses propres conversations" ON conversations;
DROP POLICY IF EXISTS "Chaque utilisateur peut modifier uniquement ses conversations" ON conversations;
DROP POLICY IF EXISTS "Chaque utilisateur peut supprimer uniquement ses conversations" ON conversations;
DROP POLICY IF EXISTS "Les admins peuvent tout faire" ON conversations;

-- Create new policies for conversations
CREATE POLICY "Users can read own conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can do anything"
  ON conversations FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

-- Grant proper permissions on materialized view
GRANT SELECT ON conversation_stats TO authenticated;
GRANT SELECT ON conversation_stats TO anon;

-- Grant permissions on functions
GRANT EXECUTE ON FUNCTION refresh_materialized_views TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_materialized_views TO anon;

-- Ensure proper ownership
ALTER MATERIALIZED VIEW conversation_stats OWNER TO postgres;

-- Refresh materialized view
REFRESH MATERIALIZED VIEW conversation_stats;