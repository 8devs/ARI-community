-- Messaging system and notification preferences
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'notification_type'
      AND e.enumlabel = 'MESSAGE'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'MESSAGE';
  END IF;
END
$$;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pref_email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pref_push_notifications BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS employee_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS employee_messages_sender_idx ON employee_messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS employee_messages_recipient_idx ON employee_messages (recipient_id, read_at);

ALTER TABLE employee_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view messages" ON employee_messages;
CREATE POLICY "Participants can view messages"
  ON employee_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Senders can create messages" ON employee_messages;
CREATE POLICY "Senders can create messages"
  ON employee_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Recipients update message state" ON employee_messages;
CREATE POLICY "Recipients update message state"
  ON employee_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

CREATE OR REPLACE FUNCTION public.get_message_threads(p_user_id UUID)
RETURNS TABLE (
  partner_id UUID,
  last_message TEXT,
  last_sender_id UUID,
  last_created_at TIMESTAMPTZ,
  unread_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_messages AS (
    SELECT
      *,
      CASE
        WHEN sender_id = p_user_id THEN recipient_id
        ELSE sender_id
      END AS partner_id
    FROM public.employee_messages
    WHERE sender_id = p_user_id OR recipient_id = p_user_id
  ),
  latest_messages AS (
    SELECT DISTINCT ON (partner_id)
      partner_id,
      body,
      sender_id,
      created_at
    FROM user_messages
    ORDER BY partner_id, created_at DESC
  )
  SELECT
    lm.partner_id,
    lm.body,
    lm.sender_id,
    lm.created_at,
    (
      SELECT COUNT(*)
      FROM public.employee_messages em
      WHERE em.recipient_id = p_user_id
        AND em.sender_id = lm.partner_id
        AND em.read_at IS NULL
    ) AS unread_count
  FROM latest_messages lm
  ORDER BY lm.created_at DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS trg_notify_employee_message ON public.employee_messages;
CREATE TRIGGER trg_notify_employee_message
  AFTER INSERT ON public.employee_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();
