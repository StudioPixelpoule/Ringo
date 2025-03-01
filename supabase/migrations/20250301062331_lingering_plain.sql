-- Create a policy to allow all authenticated users to insert logs
CREATE POLICY "All users can insert logs"
  ON logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create a policy to allow all authenticated users to read their own logs
CREATE POLICY "Users can read their own logs"
  ON logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);