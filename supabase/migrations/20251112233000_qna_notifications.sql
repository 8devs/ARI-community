-- Helper to create notifications from the client via RPC
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id UUID,
  _title TEXT,
  _body TEXT,
  _type notification_type,
  _url TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, type, url)
  VALUES (
    _user_id,
    COALESCE(_title, 'Benachrichtigung'),
    COALESCE(_body, ''),
    COALESCE(_type, 'INFO'),
    _url
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;
