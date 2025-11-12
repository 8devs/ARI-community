-- Make message notification trigger run as definer so it can bypass RLS
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, type, url)
  VALUES (
    NEW.recipient_id,
    'Neue Nachricht',
    left(NEW.body, 140),
    'MESSAGE',
    '/nachrichten'
  );
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_new_message() OWNER TO postgres;
