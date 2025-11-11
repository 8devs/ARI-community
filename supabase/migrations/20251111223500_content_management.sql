-- Allow creators and admins to manage info posts
CREATE POLICY "Post creators can update their posts"
  ON info_posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by_id)
  WITH CHECK (auth.uid() = created_by_id);

CREATE POLICY "Post creators can delete their posts"
  ON info_posts FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by_id);

CREATE POLICY "Admins can update info posts"
  ON info_posts FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete info posts"
  ON info_posts FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Allow question owners/admins to delete
CREATE POLICY "Question creators can delete their questions"
  ON questions FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by_id);

CREATE POLICY "Admins can delete questions"
  ON questions FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));
