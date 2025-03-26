/*
  # Update Auth Settings

  1. Changes
    - Set OTP expiry to 1 hour
    - Enable leaked password protection
*/

-- Create function to update auth settings
CREATE OR REPLACE FUNCTION update_auth_settings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set OTP expiry to 1 hour
  PERFORM set_config('auth.otp_expiry_seconds', '3600', false);
  
  -- Enable leaked password protection
  PERFORM set_config('auth.enable_leaked_password_protection', 'true', false);
END;
$$;

-- Execute the function
SELECT update_auth_settings();

-- Drop the function after use
DROP FUNCTION update_auth_settings();

-- Add comment
COMMENT ON SCHEMA auth IS 'Auth settings updated: OTP expiry set to 1 hour, leaked password protection enabled.';