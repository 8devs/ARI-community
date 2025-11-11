-- Add admin policies for match_rounds
CREATE POLICY "Admins can create match rounds"
  ON match_rounds FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update match rounds"
  ON match_rounds FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Add admin policies for match_pairs
CREATE POLICY "Admins can create match pairs"
  ON match_pairs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Add admin policy to delete participations if needed
CREATE POLICY "Admins can delete participations"
  ON match_participations FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Allow users to delete their own participations
CREATE POLICY "Users can delete their own participations"
  ON match_participations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);