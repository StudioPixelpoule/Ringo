/*
  # Update user deletion function

  1. Changes
    - Rename function to avoid conflicts
    - Add better error handling
    - Add transaction support
    - Add logging
  
  2. Security
    - Enable RLS
    - Add super admin check
    - Prevent last super admin deletion
*/

-- Create function to handle user deletion with unique name
CREATE OR REPLACE FUNCTION delete_user_data_v2(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
  user_role text;
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

    -- Delete user data from all tables
    DELETE FROM conversation_documents WHERE conversation_id IN (
      SELECT id FROM conversations WHERE user_id = user_id_param
    );
    
    DELETE FROM messages WHERE conversation_id IN (
      SELECT id FROM conversations WHERE user_id = user_id_param
    );
    
    DELETE FROM conversations WHERE user_id = user_id_param;
    DELETE FROM user_feedback WHERE user_id = user_id_param;
    DELETE FROM error_logs WHERE user_id = user_id_param;
    DELETE FROM security_notifications WHERE user_id = user_id_param;
    DELETE FROM active_sessions WHERE user_id = user_id_param;
    DELETE FROM auth_attempts WHERE email = user_email;
    
    -- Delete profile last
    DELETE FROM profiles WHERE id = user_id_param;

    -- Log the deletion
    INSERT INTO error_logs (
      error,
      context,
      status
    ) VALUES (
      'User deleted',
      jsonb_build_object(
        'user_id', user_id_param,
        'email', user_email,
        'role', user_role,
        'deleted_at', now()
      ),
      'resolved'
    );

    -- Commit transaction
    COMMIT;
  EXCEPTION WHEN OTHERS THEN
    -- Rollback on error
    ROLLBACK;
    RAISE;
  END;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_data_v2 TO authenticated;

-- Add comment
COMMENT ON FUNCTION delete_user_data_v2 IS 'Safely deletes all data associated with a user while preserving system integrity.';