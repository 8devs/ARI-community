-- Table for onboarding requests from unregistered users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'join_request_status'
  ) THEN
    CREATE TYPE join_request_status AS ENUM ('PENDING', 'APPROVED', 'DECLINED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  status join_request_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id)
);

ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS join_requests_status_idx ON public.join_requests (status);
CREATE INDEX IF NOT EXISTS join_requests_org_idx ON public.join_requests (organization_id);

DROP POLICY IF EXISTS "Public can create join requests" ON public.join_requests;
CREATE POLICY "Public can create join requests"
  ON public.join_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'PENDING');

DROP POLICY IF EXISTS "Admins view join requests" ON public.join_requests;
CREATE POLICY "Admins view join requests"
  ON public.join_requests FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'SUPER_ADMIN')
    OR (
      public.has_role(auth.uid(), 'ORG_ADMIN')
      AND organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Admins manage join requests" ON public.join_requests;
CREATE POLICY "Admins manage join requests"
  ON public.join_requests FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'SUPER_ADMIN')
    OR (
      public.has_role(auth.uid(), 'ORG_ADMIN')
      AND organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'SUPER_ADMIN')
    OR (
      public.has_role(auth.uid(), 'ORG_ADMIN')
      AND organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );
