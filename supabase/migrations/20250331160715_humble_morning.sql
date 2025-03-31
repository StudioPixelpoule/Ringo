-- Drop existing function
DROP FUNCTION IF EXISTS delete_user_data_v2(uuid);

-- Create improved version with better error handling and logging
CREATE OR REPLACE FUNCTION delete_user_data_v2(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
  user_role text;
  conversation_count int;
  document_count int;
  feedback_count int;
  error_context jsonb;
BEGIN
  -- Start transaction
  BEGIN
    -- Get user info for logging
    SELECT email, role INTO user_email, user_role
    FROM profiles 
    WHERE id = user_id_param;

    -- Check if user exists
    IF user_email IS NULL THEN
      RAISE EXCEPTION 'User not found';
    END IF;

    -- Check if user is the last super admin
    IF user_role = 'super_admin' THEN
      IF (
        SELECT COUNT(*) 
        FROM profiles 
        WHERE role = 'super_admin' 
        AND status = true
      ) <= 1 THEN
        RAISE EXCEPTION 'Cannot delete the last super admin';
      END IF;
    END IF;

    -- Count data to be deleted for logging
    SELECT COUNT(*) INTO conversation_count
    FROM conversations 
    WHERE user_id = user_id_param;

    SELECT COUNT(*) INTO document_count
    FROM documents d
    INNER JOIN folders f ON d.folder_id = f.id
    WHERE f.id IN (
      SELECT id FROM folders WHERE id = user_id_param
    );

    SELECT COUNT(*) INTO feedback_count
    FROM user_feedback
    WHERE user_id = user_id_param;

    -- Build error context
    error_context := jsonb_build_object(
      'user_id', user_id_param,
      'email', user_email,
      'role', user_role,
      'data_counts', jsonb_build_object(
        'conversations', conversation_count,
        'documents', document_count,
        'feedback', feedback_count
      ),
      'timestamp', now()
    );

    -- Delete user data from all tables in correct order
    -- First, delete dependent records
    DELETE FROM conversation_documents 
    WHERE conversation_id IN (
      SELECT id FROM conversations WHERE user_id = user_id_param
    );
    
    DELETE FROM messages 
    WHERE conversation_id IN (
      SELECT id FROM conversations WHERE user_id = user_id_param
    );
    
    -- Then delete main records
    DELETE FROM conversations WHERE user_id = user_id_param;
    DELETE FROM user_feedback WHERE user_id = user_id_param;
    DELETE FROM error_logs WHERE user_id = user_id_param;
    DELETE FROM security_notifications WHERE user_id = user_id_param;
    DELETE FROM active_sessions WHERE user_id = user_id_param;
    DELETE FROM auth_attempts WHERE email = user_email;
    
    -- Delete profile last
    DELETE FROM profiles WHERE id = user_id_param;

    -- Log successful deletion
    INSERT INTO error_logs (
      error,
      context,
      status
    ) VALUES (
      'User deleted successfully',
      error_context || jsonb_build_object('success', true),
      'resolved'
    );

    -- Commit transaction
    COMMIT;
  EXCEPTION WHEN OTHERS THEN
    -- Log error and rollback
    error_context := error_context || jsonb_build_object(
      'error_details', SQLERRM,
      'error_hint', SQLSTATE,
      'success', false
    );

    INSERT INTO error_logs (
      error,
      stack,
      context,
      status
    ) VALUES (
      'Failed to delete user data',
      SQLERRM,
      error_context,
      'new'
    );
    
    -- Rollback transaction
    ROLLBACK;
    RAISE;
  END;
END;
$$;

-- Add comment
COMMENT ON FUNCTION delete_user_data_v2(uuid) IS 'Safely deletes all data associated with a user while preserving system integrity.';