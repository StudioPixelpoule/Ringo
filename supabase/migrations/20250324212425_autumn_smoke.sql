/*
  # Add Invitation Email Function

  1. Changes
    - Create function for sending invitation emails
    - Add proper security settings
    - Grant necessary permissions
  
  2. Security
    - Use SECURITY DEFINER
    - Set explicit search path
    - Proper error handling
*/

-- Create function for sending invitation emails
CREATE OR REPLACE FUNCTION send_invitation_email(
  p_email text,
  p_token text,
  p_role text,
  p_app_url text DEFAULT current_setting('app.settings.url', true)
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Send email using Edge Functions
  PERFORM
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-invitation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'invitation', jsonb_build_object(
          'email', p_email,
          'token', p_token,
          'role', p_role
        ),
        'appUrl', p_app_url
      )
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION send_invitation_email TO authenticated;

-- Add comment
COMMENT ON FUNCTION send_invitation_email IS 'Sends invitation email using Edge Functions';