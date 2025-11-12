-- Create storage buckets for organization logos and profile avatars
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'organization-logos'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('organization-logos', 'organization-logos', TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'profile-avatars'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('profile-avatars', 'profile-avatars', TRUE);
  END IF;
END
$$;

-- Allow everyone to read organization logos, but only super admins can manage them
DROP POLICY IF EXISTS "Public can read organization logos" ON storage.objects;
CREATE POLICY "Public can read organization logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'organization-logos');

DROP POLICY IF EXISTS "Super admins manage organization logos" ON storage.objects;
CREATE POLICY "Super admins manage organization logos"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'organization-logos'
    AND public.has_role(auth.uid(), 'SUPER_ADMIN')
  )
  WITH CHECK (
    bucket_id = 'organization-logos'
    AND public.has_role(auth.uid(), 'SUPER_ADMIN')
  );

-- Profile avatars: readable for everyone, owners manage their own uploads
DROP POLICY IF EXISTS "Public can read profile avatars" ON storage.objects;
CREATE POLICY "Public can read profile avatars"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'profile-avatars');

DROP POLICY IF EXISTS "Users manage their own avatars" ON storage.objects;
CREATE POLICY "Users manage their own avatars"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND owner = auth.uid()
  )
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND owner = auth.uid()
  );
