-- Add optional website link per organization
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Flag profiles that may manage news/pinnwand content
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_news_manager BOOLEAN NOT NULL DEFAULT FALSE;

-- Helper to determine whether a user may manage public news
CREATE OR REPLACE FUNCTION public.can_manage_news(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND (is_news_manager OR role = 'SUPER_ADMIN')
  );
$$;

DROP FUNCTION IF EXISTS public.get_organizations_with_counts();

-- Update the organization overview helper to include websites
CREATE FUNCTION public.get_organizations_with_counts()
RETURNS TABLE (
  id UUID,
  name TEXT,
  logo_url TEXT,
  location_text TEXT,
  cost_center_code TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website_url TEXT,
  created_at TIMESTAMPTZ,
  member_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.name,
    o.logo_url,
    o.location_text,
    o.cost_center_code,
    o.contact_name,
    o.contact_email,
    o.contact_phone,
    o.website_url,
    o.created_at,
    COUNT(p.id) AS member_count
  FROM public.organizations o
  LEFT JOIN public.profiles p ON p.organization_id = o.id
  GROUP BY o.id
  ORDER BY o.name;
$$;

-- Restrict who may create/edit/delete info posts
DROP POLICY IF EXISTS "Authenticated users can create posts" ON info_posts;

CREATE POLICY "News managers create posts"
  ON info_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_manage_news(auth.uid())
    AND auth.uid() = created_by_id
  );

CREATE POLICY "News managers update posts"
  ON info_posts FOR UPDATE
  TO authenticated
  USING (
    (public.can_manage_news(auth.uid()) AND auth.uid() = created_by_id)
    OR public.has_role(auth.uid(), 'SUPER_ADMIN')
  )
  WITH CHECK (
    (public.can_manage_news(auth.uid()) AND auth.uid() = created_by_id)
    OR public.has_role(auth.uid(), 'SUPER_ADMIN')
  );

CREATE POLICY "News managers delete posts"
  ON info_posts FOR DELETE
  TO authenticated
  USING (
    (public.can_manage_news(auth.uid()) AND auth.uid() = created_by_id)
    OR public.has_role(auth.uid(), 'SUPER_ADMIN')
  );
