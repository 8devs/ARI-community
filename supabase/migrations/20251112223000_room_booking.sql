-- Room catalog and calendar bookings
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  description TEXT,
  capacity INTEGER,
  equipment TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  organization_id UUID REFERENCES organizations(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS capacity INTEGER,
  ADD COLUMN IF NOT EXISTS equipment TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_timestamp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rooms_set_updated_at ON rooms;
CREATE TRIGGER rooms_set_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_timestamp_updated_at();

CREATE TABLE IF NOT EXISTS room_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE room_bookings
  ADD CONSTRAINT room_bookings_time_check CHECK (start_time < end_time);

DROP TRIGGER IF EXISTS room_bookings_set_updated_at ON room_bookings;
CREATE TRIGGER room_bookings_set_updated_at
  BEFORE UPDATE ON room_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_timestamp_updated_at();

ALTER TABLE room_bookings
  DROP CONSTRAINT IF EXISTS room_booking_no_overlap;

ALTER TABLE room_bookings
  ADD CONSTRAINT room_booking_no_overlap
  EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  );

CREATE INDEX IF NOT EXISTS room_bookings_room_idx
  ON room_bookings (room_id, start_time);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can view rooms" ON rooms;
CREATE POLICY "Employees can view rooms"
  ON rooms FOR SELECT
  TO authenticated
  USING (is_active OR public.has_role(auth.uid(), 'SUPER_ADMIN') OR public.has_role(auth.uid(), 'ORG_ADMIN'));

DROP POLICY IF EXISTS "Admins manage rooms" ON rooms;
CREATE POLICY "Admins manage rooms"
  ON rooms FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN') OR public.has_role(auth.uid(), 'ORG_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN') OR public.has_role(auth.uid(), 'ORG_ADMIN'));

DROP POLICY IF EXISTS "Employees can view bookings" ON room_bookings;
CREATE POLICY "Employees can view bookings"
  ON room_bookings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Employees can create bookings" ON room_bookings;
CREATE POLICY "Employees can create bookings"
  ON room_bookings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Booking owners can update" ON room_bookings;
CREATE POLICY "Booking owners can update"
  ON room_bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Admins manage bookings" ON room_bookings;
CREATE POLICY "Admins manage bookings"
  ON room_bookings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN') OR public.has_role(auth.uid(), 'ORG_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN') OR public.has_role(auth.uid(), 'ORG_ADMIN'));
