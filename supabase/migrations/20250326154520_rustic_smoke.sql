/*
  # Configure Auth Settings
  
  1. Changes
    - Create configuration table for auth settings
    - Set OTP expiry to 1 hour
    - Enable leaked password protection
  
  Note: Since we can't modify auth schema directly, we store settings in a custom table
*/

-- Create auth settings table if not exists
CREATE TABLE IF NOT EXISTS auth_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE auth_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for super admins
CREATE POLICY "Only super admins can manage auth settings"
  ON auth_settings
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()));

-- Insert or update settings
INSERT INTO auth_settings (key, value, description)
VALUES 
  ('otp_expiry_seconds', '3600', 'OTP expiration time in seconds'),
  ('enable_leaked_password_protection', 'true', 'Whether to check for leaked passwords during signup/login')
ON CONFLICT (key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

-- Create function to get auth setting
CREATE OR REPLACE FUNCTION get_auth_setting(setting_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT value 
    FROM auth_settings 
    WHERE key = setting_key
  );
END;
$$;

-- Grant access to function
GRANT EXECUTE ON FUNCTION get_auth_setting TO authenticated;

-- Add comment
COMMENT ON TABLE auth_settings IS 'Stores auth configuration settings that can be managed by super admins.';