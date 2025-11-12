CREATE OR REPLACE FUNCTION public.get_organizations_with_counts()
RETURNS TABLE (
  id UUID,
  name TEXT,
  logo_url TEXT,
  location_text TEXT,
  cost_center_code TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
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
    o.created_at,
    COUNT(p.id) AS member_count
  FROM public.organizations o
  LEFT JOIN public.profiles p ON p.organization_id = o.id
  GROUP BY o.id
  ORDER BY o.name;
$$;
