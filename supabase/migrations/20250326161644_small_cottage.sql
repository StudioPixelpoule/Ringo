/*
  # Deploy Edge Functions Configuration

  1. Security Functions
    - Create helper functions for Edge Function authentication
    - Add necessary permissions and policies
    - Set up secure defaults

  2. Function Configurations
    - Set up configuration tables
    - Add function metadata
    - Configure security settings
*/

-- Create configuration table for Edge Functions
CREATE TABLE IF NOT EXISTS edge_function_configs (
  function_name text PRIMARY KEY,
  version text NOT NULL,
  verify_jwt boolean DEFAULT true,
  import_map jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE edge_function_configs ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_edge_function_configs_name ON edge_function_configs(function_name);
CREATE INDEX IF NOT EXISTS idx_edge_function_configs_version ON edge_function_configs(version);

-- Create RLS policies
CREATE POLICY "Only super admins can manage function configs"
  ON edge_function_configs
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()));

-- Insert function configurations
INSERT INTO edge_function_configs (
  function_name,
  version,
  verify_jwt,
  import_map
) VALUES 
  (
    'create-user',
    '1.0.0',
    true,
    '{"imports":{"@supabase/supabase-js":"https://esm.sh/@supabase/supabase-js@2.39.7"}}'
  ),
  (
    'delete-user',
    '1.0.0', 
    true,
    '{"imports":{"@supabase/supabase-js":"https://esm.sh/@supabase/supabase-js@2.39.7"}}'
  ),
  (
    'send-invitation',
    '1.0.0',
    true,
    '{"imports":{"@supabase/supabase-js":"https://esm.sh/@supabase/supabase-js@2.39.7","smtp":"https://deno.land/x/smtp@v0.7.0/mod.ts"}}'
  )
ON CONFLICT (function_name) 
DO UPDATE SET
  version = EXCLUDED.version,
  verify_jwt = EXCLUDED.verify_jwt,
  import_map = EXCLUDED.import_map,
  updated_at = now();

-- Create function to get Edge Function config
CREATE OR REPLACE FUNCTION get_edge_function_config(function_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'function_name', function_name,
      'version', version,
      'verify_jwt', verify_jwt,
      'import_map', import_map
    )
    FROM edge_function_configs
    WHERE function_name = $1
  );
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION get_edge_function_config TO authenticated;

-- Add comments
COMMENT ON TABLE edge_function_configs IS 'Stores configuration for Edge Functions';
COMMENT ON FUNCTION get_edge_function_config IS 'Retrieves configuration for a specific Edge Function';