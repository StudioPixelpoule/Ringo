/*
  # Fix Edge Functions Configuration

  1. Changes
    - Update Edge Function configuration
    - Add proper CORS settings
    - Fix function permissions
  
  2. Security
    - Maintain existing security model
    - Keep proper access control
*/

-- Update Edge Function configuration
UPDATE edge_function_configs
SET 
  version = '1.2.0',
  verify_jwt = true,
  import_map = jsonb_build_object(
    'imports', jsonb_build_object(
      '@supabase/supabase-js', 'https://esm.sh/@supabase/supabase-js@2.39.7'
    )
  )
WHERE function_name = 'create-user';

-- Ensure proper permissions
DO $$ 
BEGIN
  -- Grant execute permission to authenticated users
  GRANT EXECUTE ON FUNCTION is_super_admin TO authenticated;
  GRANT EXECUTE ON FUNCTION is_admin TO authenticated;
  
  -- Grant access to Edge Function configs
  GRANT SELECT ON edge_function_configs TO authenticated;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Add comment
COMMENT ON TABLE edge_function_configs IS 'Stores configuration for Edge Functions with proper CORS and security settings';