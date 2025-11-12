CREATE OR REPLACE FUNCTION public.delete_user_with_scope(_target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_role public.app_role;
  requester_org UUID;
  target_org UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED'
      USING MESSAGE = 'Nur angemeldete Nutzer können Benutzer löschen.';
  END IF;

  SELECT role, organization_id
  INTO requester_role, requester_org
  FROM public.profiles
  WHERE id = auth.uid();

  IF requester_role IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND'
      USING MESSAGE = 'Dein Profil konnte nicht gefunden werden.';
  END IF;

  SELECT organization_id
  INTO target_org
  FROM public.profiles
  WHERE id = _target_user_id;

  IF requester_role = 'SUPER_ADMIN' THEN
    -- super admins can delete everyone
    DELETE FROM auth.users WHERE id = _target_user_id;
    RETURN TRUE;
  END IF;

  IF requester_role = 'ORG_ADMIN' THEN
    IF requester_org IS NULL OR target_org IS DISTINCT FROM requester_org THEN
      RAISE EXCEPTION 'FORBIDDEN'
        USING MESSAGE = 'Du kannst nur Mitglieder Deiner Organisation löschen.';
    END IF;

    DELETE FROM auth.users WHERE id = _target_user_id;
    RETURN TRUE;
  END IF;

  RAISE EXCEPTION 'FORBIDDEN'
    USING MESSAGE = 'Keine Berechtigung zum Löschen.';
END;
$$;
