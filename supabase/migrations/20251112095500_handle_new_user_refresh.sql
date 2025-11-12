CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role public.app_role;
  target_org UUID;
BEGIN
  target_role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::public.app_role,
    'MEMBER'
  );

  SELECT COALESCE(
    (NEW.raw_user_meta_data->>'organization_id')::UUID,
    (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
  )
  INTO target_org;

  IF target_org IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Es muss mindestens eine Organisation existieren, bevor sich Benutzer registrieren können.';
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    name,
    role,
    organization_id,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Neuer Nutzer'),
    target_role,
    target_org,
    NOW(),
    NOW()
  );

  RETURN NEW;
END;
$$;
