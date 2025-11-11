CREATE OR REPLACE FUNCTION public.get_invitation_details(_token UUID)
RETURNS TABLE (
  email TEXT,
  role app_role,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  organization_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.email,
    i.role,
    i.expires_at,
    i.accepted_at,
    o.name AS organization_name
  FROM public.employee_invitations i
  LEFT JOIN public.organizations o ON o.id = i.organization_id
  WHERE i.token = _token;
$$;
