/*
  # Database Index Optimization

  1. Changes
    - Remove redundant content search index
    - Add composite indexes for better performance
    - Optimize existing indexes
  
  2. Performance
    - Improve query performance for common operations
    - Reduce index maintenance overhead
    - Better space utilization
*/

-- Drop redundant index
DROP INDEX IF EXISTS idx_documents_content_search;

-- Create optimized composite indexes
CREATE INDEX IF NOT EXISTS idx_conversation_messages_time 
  ON messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_document_contents_search 
  ON document_contents USING gin(to_tsvector('french', content));

-- Optimize existing indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_time 
  ON conversations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_sender 
  ON messages(conversation_id, sender, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_folder_type 
  ON documents(folder_id, type, created_at DESC);

-- Add index for document processing status
CREATE INDEX IF NOT EXISTS idx_documents_processed_status 
  ON documents(processed);

-- Add index for active profiles
CREATE INDEX IF NOT EXISTS idx_profiles_active_role 
  ON profiles(role, status);

-- Add index for document cache cleanup
CREATE INDEX IF NOT EXISTS idx_document_cache_cleanup 
  ON document_cache(cached_at);

-- Add index for conversation documents
CREATE INDEX IF NOT EXISTS idx_conversation_documents_lookup 
  ON conversation_documents(conversation_id, document_id);

-- Add partial index for admin checks
CREATE INDEX IF NOT EXISTS idx_profiles_admin_lookup 
  ON profiles(id, role, status) 
  WHERE role = 'admin' AND status = true;

-- Add index for user session validation
CREATE INDEX IF NOT EXISTS idx_profiles_session_check 
  ON profiles(id, status);

-- Add index for document content lookups
CREATE INDEX IF NOT EXISTS idx_document_contents_lookup 
  ON document_contents(document_id);

-- Add index for folder hierarchy
CREATE INDEX IF NOT EXISTS idx_folders_hierarchy 
  ON folders(parent_id, name);

-- Add index for document metadata
CREATE INDEX IF NOT EXISTS idx_documents_metadata 
  ON documents(type, group_name, processed);

-- Add index for message search
CREATE INDEX IF NOT EXISTS idx_messages_content_search 
  ON messages USING gin(to_tsvector('french', content));

-- Add index for security notifications
CREATE INDEX IF NOT EXISTS idx_security_notifications_unread 
  ON security_notifications(user_id, read_at);

-- Add index for active sessions
CREATE INDEX IF NOT EXISTS idx_active_sessions_valid 
  ON active_sessions(user_id, expires_at);

-- Add index for auth attempts
CREATE INDEX IF NOT EXISTS idx_auth_attempts_recent 
  ON auth_attempts(email, attempted_at DESC);

-- Analyze tables to update statistics
ANALYZE messages;
ANALYZE conversations;
ANALYZE documents;
ANALYZE document_contents;
ANALYZE profiles;
ANALYZE folders;
ANALYZE conversation_documents;
ANALYZE document_cache;
ANALYZE security_notifications;
ANALYZE active_sessions;
ANALYZE auth_attempts;