-- Allow everyone (including anonymous visitors) to read the branding setting,
-- while keeping updates restricted to admins through the existing policy.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'settings'
      AND policyname = 'Public can view branding setting'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Public can view branding setting"
        ON settings FOR SELECT
        TO public
        USING (key = 'app_branding');
    $policy$;
  END IF;
END
$$;

-- Ensure the branding row exists so admins can immediately update it.
INSERT INTO public.settings (key, value)
VALUES ('app_branding', jsonb_build_object('logo_url', NULL))
ON CONFLICT (key) DO NOTHING;
