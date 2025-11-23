-- Lunch menu storage bucket & policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'lunch-menus'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('lunch-menus', 'lunch-menus', TRUE);
  END IF;
END
$$;

-- anyone may view published menus
DROP POLICY IF EXISTS "Public can read lunch menus" ON storage.objects;
CREATE POLICY "Public can read lunch menus"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'lunch-menus');

-- authenticated users manage their own uploads
DROP POLICY IF EXISTS "Users manage their lunch menus" ON storage.objects;
CREATE POLICY "Users manage their lunch menus"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'lunch-menus'
    AND owner = auth.uid()
  )
  WITH CHECK (
    bucket_id = 'lunch-menus'
    AND owner = auth.uid()
  );

-- admins can help with moderation
DROP POLICY IF EXISTS "Admins manage all lunch menus" ON storage.objects;
CREATE POLICY "Admins manage all lunch menus"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'lunch-menus'
    AND public.has_role(auth.uid(), 'SUPER_ADMIN')
  )
  WITH CHECK (
    bucket_id = 'lunch-menus'
    AND public.has_role(auth.uid(), 'SUPER_ADMIN')
  );
