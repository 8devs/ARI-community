-- Event manager capabilities and public/internal events
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_event_manager BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'audience'
  ) THEN
    ALTER TABLE events
      ADD COLUMN audience audience_type NOT NULL DEFAULT 'INTERNAL';
  END IF;
END
$$;

UPDATE events
SET audience = CASE WHEN is_open_to_all THEN 'PUBLIC' ELSE 'INTERNAL' END
WHERE audience IS NULL;

CREATE OR REPLACE FUNCTION public.can_manage_events(_user_id UUID)
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
      AND (role = 'SUPER_ADMIN' OR is_event_manager)
  );
$$;

DROP POLICY IF EXISTS "Events are viewable by authenticated users" ON events;
DROP POLICY IF EXISTS "Authenticated users can create events" ON events;

CREATE POLICY "Public events visible to everyone"
  ON events FOR SELECT
  TO public
  USING (audience = 'PUBLIC');

CREATE POLICY "Authenticated users view all events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Event managers create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_manage_events(auth.uid())
    AND owner_id = auth.uid()
  );

CREATE POLICY "Event managers update events"
  ON events FOR UPDATE
  TO authenticated
  USING (public.can_manage_events(auth.uid()))
  WITH CHECK (public.can_manage_events(auth.uid()));

CREATE POLICY "Event managers delete events"
  ON events FOR DELETE
  TO authenticated
  USING (public.can_manage_events(auth.uid()));
