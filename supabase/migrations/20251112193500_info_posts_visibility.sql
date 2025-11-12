-- Extend info posts with attachments and organization-scoped visibility
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'audience_type'
      AND e.enumlabel = 'ORG_ONLY'
  ) THEN
    ALTER TYPE audience_type ADD VALUE 'ORG_ONLY';
  END IF;
END
$$;

ALTER TABLE info_posts
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS target_organization_id UUID REFERENCES organizations(id);

ALTER TABLE info_posts
  ADD CONSTRAINT info_posts_org_audience_check
  CHECK (audience <> 'ORG_ONLY' OR target_organization_id IS NOT NULL);

UPDATE info_posts ip
SET target_organization_id = p.organization_id
FROM profiles p
WHERE ip.target_organization_id IS NULL
  AND ip.created_by_id = p.id;

INSERT INTO storage.buckets (id, name, public)
SELECT 'info-post-attachments', 'info-post-attachments', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'info-post-attachments'
);

DROP POLICY IF EXISTS "Public can read info post attachments" ON storage.objects;
DROP POLICY IF EXISTS "News managers manage info post attachments" ON storage.objects;

CREATE POLICY "Public can read info post attachments"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'info-post-attachments');

CREATE POLICY "News managers manage info post attachments"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'info-post-attachments'
    AND public.can_manage_news(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'info-post-attachments'
    AND public.can_manage_news(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.can_view_org_post(_user_id UUID, _organization_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _organization_id IS NULL THEN FALSE
    ELSE EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = _user_id
        AND organization_id = _organization_id
    )
  END;
$$;

DROP POLICY IF EXISTS "Public posts are viewable by everyone" ON info_posts;
DROP POLICY IF EXISTS "Internal posts viewable by authenticated users" ON info_posts;

CREATE POLICY "Public posts viewable by everyone"
  ON info_posts FOR SELECT
  TO public
  USING (audience = 'PUBLIC');

CREATE POLICY "Authenticated users view restricted posts"
  ON info_posts FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'SUPER_ADMIN')
    OR (
      audience IN ('INTERNAL', 'ORG_ONLY')
      AND (
        audience <> 'ORG_ONLY'
        OR public.can_view_org_post(auth.uid(), target_organization_id)
      )
    )
  );

DROP POLICY IF EXISTS "News managers create posts" ON info_posts;

CREATE POLICY "News managers create posts"
  ON info_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_manage_news(auth.uid())
    AND auth.uid() = created_by_id
    AND (
      audience <> 'ORG_ONLY'
      OR public.has_role(auth.uid(), 'SUPER_ADMIN')
      OR public.can_view_org_post(auth.uid(), target_organization_id)
    )
  );

DROP POLICY IF EXISTS "News managers update posts" ON info_posts;

CREATE POLICY "News managers update posts"
  ON info_posts FOR UPDATE
  TO authenticated
  USING (
    (public.can_manage_news(auth.uid()) AND auth.uid() = created_by_id)
    OR public.has_role(auth.uid(), 'SUPER_ADMIN')
  )
  WITH CHECK (
    (
      (public.can_manage_news(auth.uid()) AND auth.uid() = created_by_id)
      OR public.has_role(auth.uid(), 'SUPER_ADMIN')
    )
    AND (
      audience <> 'ORG_ONLY'
      OR public.has_role(auth.uid(), 'SUPER_ADMIN')
      OR public.can_view_org_post(auth.uid(), target_organization_id)
    )
  );

DROP POLICY IF EXISTS "News managers delete posts" ON info_posts;

CREATE POLICY "News managers delete posts"
  ON info_posts FOR DELETE
  TO authenticated
  USING (
    (public.can_manage_news(auth.uid()) AND auth.uid() = created_by_id)
    OR public.has_role(auth.uid(), 'SUPER_ADMIN')
  );
