-- Enforce logos on organizations and organization membership on profiles
ALTER TABLE organizations
  ALTER COLUMN logo_url SET NOT NULL;

ALTER TABLE profiles
  ALTER COLUMN organization_id SET NOT NULL;

-- Helper to verify if a user can administer a specific organization
CREATE OR REPLACE FUNCTION public.is_org_admin_of(_user_id UUID, _organization_id UUID)
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
      AND (
        role = 'SUPER_ADMIN'
        OR (role = 'ORG_ADMIN' AND organization_id = _organization_id)
      )
  );
$$;

-- Organizations must remain readable for anonymous visitors
CREATE POLICY "Organizations are viewable by anonymous visitors"
  ON organizations FOR SELECT
  TO anon
  USING (true);

-- Only super admins can create or modify organizations
CREATE POLICY "Super admins manage organizations"
  ON organizations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN'));

-- Super admins may manage every profile
CREATE POLICY "Super admins manage all profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN'));

-- Org admins may administrate members inside their org
CREATE POLICY "Org admins administer their organization"
  ON profiles FOR UPDATE
  TO authenticated
  USING (public.is_org_admin_of(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin_of(auth.uid(), organization_id));

-- Invitations table to manage employee onboarding
CREATE TABLE employee_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'MEMBER' CHECK (role != 'SUPER_ADMIN'),
  token UUID NOT NULL DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '14 days',
  accepted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX employee_invitations_token_key ON employee_invitations(token);
CREATE UNIQUE INDEX employee_invitations_email_org_idx
  ON employee_invitations (lower(email), organization_id);

ALTER TABLE employee_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view invitations"
  ON employee_invitations FOR SELECT
  TO authenticated
  USING (public.is_org_admin_of(auth.uid(), organization_id));

CREATE POLICY "Admins can create invitations"
  ON employee_invitations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_admin_of(auth.uid(), organization_id));

CREATE POLICY "Admins can update invitations"
  ON employee_invitations FOR UPDATE
  TO authenticated
  USING (public.is_org_admin_of(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin_of(auth.uid(), organization_id));

CREATE POLICY "Admins can delete invitations"
  ON employee_invitations FOR DELETE
  TO authenticated
  USING (public.is_org_admin_of(auth.uid(), organization_id));

-- Only invited users may finish signup and they inherit the invited role & organization
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_record employee_invitations%ROWTYPE;
BEGIN
  SELECT *
  INTO invitation_record
  FROM public.employee_invitations
  WHERE lower(email) = lower(NEW.email)
    AND accepted_at IS NULL
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITATION_REQUIRED'
      USING MESSAGE = 'Für die Registrierung ist eine gültige Einladung erforderlich.';
  END IF;

  INSERT INTO public.profiles (id, email, name, role, organization_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', invitation_record.email),
    invitation_record.role,
    invitation_record.organization_id
  );

  UPDATE public.employee_invitations
    SET accepted_at = NOW()
    WHERE id = invitation_record.id;

  RETURN NEW;
END;
$$;
