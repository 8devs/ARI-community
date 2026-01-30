-- Allow unauthenticated users (anon) to view active rooms
DROP POLICY IF EXISTS "Public can view active rooms" ON rooms;
CREATE POLICY "Public can view active rooms"
  ON rooms FOR SELECT
  TO anon
  USING (is_active);
