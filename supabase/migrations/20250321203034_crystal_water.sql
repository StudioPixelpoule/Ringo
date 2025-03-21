/*
  # Fix Function Security Settings

  1. Changes
    - Add SECURITY DEFINER to functions
    - Set search_path explicitly
    - Fix function permissions
    - Update function definitions for better security

  2. Security
    - Prevent search path injection
    - Maintain proper access control
    - Improve function security
*/

-- Update functions with proper security settings
CREATE OR REPLACE FUNCTION increment_template_usage()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE report_templates
  SET usage_count = usage_count + 1
  WHERE id = NEW.template_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION delete_user_data()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM conversations WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_old_auth_attempts()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM auth_attempts
  WHERE attempted_at < now() - interval '24 hours';
END;
$$;

CREATE OR REPLACE FUNCTION create_security_notification(
  p_user_id uuid,
  p_type text,
  p_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO security_notifications (user_id, type, message, metadata)
  VALUES (p_user_id, p_type, p_message, p_metadata);
END;
$$;

CREATE OR REPLACE FUNCTION check_suspicious_login(
  p_user_id uuid,
  p_ip_address text,
  p_user_agent text
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  last_login record;
BEGIN
  SELECT ip_address, user_agent, attempted_at
  INTO last_login
  FROM auth_attempts
  WHERE email = (SELECT email FROM auth.users WHERE id = p_user_id)
    AND success = true
  ORDER BY attempted_at DESC
  LIMIT 1;

  IF last_login IS NULL THEN
    RETURN false;
  END IF;

  IF last_login.ip_address != p_ip_address OR last_login.user_agent != p_user_agent THEN
    PERFORM create_security_notification(
      p_user_id,
      'suspicious_login',
      'Nouvelle connexion détectée depuis un appareil inconnu',
      jsonb_build_object(
        'ip_address', p_ip_address,
        'user_agent', p_user_agent,
        'previous_ip', last_login.ip_address,
        'previous_user_agent', last_login.user_agent
      )
    );
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION check_conversation_ownership(
  conversation_id uuid,
  user_id uuid
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_id
    AND c.user_id = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = user_id
      AND status = true
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_user_conversations(user_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  created_at timestamptz,
  message_count bigint
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
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
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND status = true
  )
  GROUP BY c.id, c.title, c.created_at
  ORDER BY c.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION check_user_access(user_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND status = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_document_cache()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM document_cache
  WHERE cached_at < NOW() - INTERVAL '1 hour';
END;
$$;

CREATE OR REPLACE FUNCTION should_cleanup_cache()
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN EXTRACT(MINUTE FROM CURRENT_TIMESTAMP) = 0;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_cleanup_document_cache()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF should_cleanup_cache() THEN
    PERFORM cleanup_document_cache();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validate_session(
  p_session_id uuid,
  p_user_id uuid
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM active_sessions
    WHERE id = p_session_id
    AND user_id = p_user_id
    AND expires_at > now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION trigger_session_cleanup()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF EXTRACT(minute FROM CURRENT_TIMESTAMP) = 0 THEN
    PERFORM cleanup_expired_sessions();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE user_invitations
  SET status = 'expired'
  WHERE 
    status = 'pending'
    AND expires_at < now();
END;
$$;

CREATE OR REPLACE FUNCTION trigger_invitation_cleanup()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF EXTRACT(minute FROM CURRENT_TIMESTAMP) = 0 THEN
    PERFORM cleanup_expired_invitations();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS text
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  token text;
BEGIN
  token := encode(gen_random_bytes(32), 'hex');
  RETURN token;
END;
$$;

CREATE OR REPLACE FUNCTION validate_invitation_token(token_to_check text)
RETURNS TABLE (
  is_valid boolean,
  email text,
  role text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN i.status = 'pending' 
        AND i.expires_at > now() 
      THEN true 
      ELSE false 
    END as is_valid,
    i.email,
    i.role
  FROM user_invitations i
  WHERE i.token = token_to_check
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION accept_invitation(
  token_to_accept text,
  user_id uuid
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE user_invitations
  SET 
    status = 'accepted',
    accepted_at = now()
  WHERE 
    token = token_to_accept
    AND status = 'pending'
    AND expires_at > now();

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION is_disposable_email(email text)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN email ~* '@(temp-mail\.|tempmail\.|throwaway\.|disposable\.)';
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM active_sessions
  WHERE expires_at < now();
END;
$$;

CREATE OR REPLACE FUNCTION check_login_attempts(
  p_email text,
  p_ip text
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  attempt_count int;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM auth_attempts
  WHERE email = p_email 
    AND ip_address = p_ip
    AND success = false
    AND attempted_at > now() - interval '15 minutes';
  RETURN attempt_count < 5;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_auth_data()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM auth_attempts
  WHERE attempted_at < now() - interval '24 hours';
  
  DELETE FROM active_sessions
  WHERE expires_at < now();
  
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  NEW.last_active_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION is_valid_email(email text)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_document_processed()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  NEW.processed := EXISTS (
    SELECT 1 FROM document_contents
    WHERE document_id = NEW.id
  );
  RETURN NEW;
END;
$$;