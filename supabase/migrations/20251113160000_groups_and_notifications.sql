-- Community groups tables for cross-organization coordination
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'group_visibility') THEN
    CREATE TYPE group_visibility AS ENUM ('PUBLIC', 'PRIVATE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'group_member_role') THEN
    CREATE TYPE group_member_role AS ENUM ('MEMBER', 'ADMIN');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS community_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  visibility group_visibility NOT NULL DEFAULT 'PUBLIC',
  created_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role group_member_role NOT NULL DEFAULT 'MEMBER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.is_group_member(_user_id UUID, _group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_members
    WHERE user_id = _user_id
      AND group_id = _group_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(_user_id UUID, _group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_members
    WHERE user_id = _user_id
      AND group_id = _group_id
      AND role = 'ADMIN'
  );
$$;

CREATE OR REPLACE FUNCTION public.touch_group_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_group_updated_at ON community_groups;
CREATE TRIGGER trg_touch_group_updated_at
  BEFORE UPDATE ON community_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_group_updated_at();

CREATE OR REPLACE FUNCTION public.add_group_creator_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by_id, 'ADMIN')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_group_creator_member ON community_groups;
CREATE TRIGGER trg_add_group_creator_member
  AFTER INSERT ON community_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.add_group_creator_member();

ALTER TABLE community_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Groups are visible" ON community_groups;
CREATE POLICY "Groups are visible"
  ON community_groups FOR SELECT
  TO authenticated
  USING (
    visibility = 'PUBLIC'
    OR public.is_group_member(auth.uid(), id)
  );

DROP POLICY IF EXISTS "Create groups" ON community_groups;
CREATE POLICY "Create groups"
  ON community_groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_id);

DROP POLICY IF EXISTS "Update groups" ON community_groups;
CREATE POLICY "Update groups"
  ON community_groups FOR UPDATE
  TO authenticated
  USING (public.is_group_admin(auth.uid(), id))
  WITH CHECK (public.is_group_admin(auth.uid(), id));

DROP POLICY IF EXISTS "Delete groups" ON community_groups;
CREATE POLICY "Delete groups"
  ON community_groups FOR DELETE
  TO authenticated
  USING (public.is_group_admin(auth.uid(), id));

DROP POLICY IF EXISTS "Select group members" ON group_members;
CREATE POLICY "Select group members"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    public.is_group_member(auth.uid(), group_id)
    OR EXISTS (
      SELECT 1
      FROM community_groups cg
      WHERE cg.id = group_members.group_id
        AND cg.visibility = 'PUBLIC'
    )
  );

DROP POLICY IF EXISTS "Join public groups" ON group_members;
CREATE POLICY "Join public groups"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM community_groups cg
      WHERE cg.id = group_id
        AND (cg.visibility = 'PUBLIC' OR public.is_group_admin(auth.uid(), group_id))
    )
  );

DROP POLICY IF EXISTS "Leave or manage membership" ON group_members;
CREATE POLICY "Leave or manage membership"
  ON group_members FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_group_admin(auth.uid(), group_id)
  );

DROP POLICY IF EXISTS "Select group messages" ON group_messages;
CREATE POLICY "Select group messages"
  ON group_messages FOR SELECT
  TO authenticated
  USING (public.is_group_member(auth.uid(), group_id));

DROP POLICY IF EXISTS "Send group messages" ON group_messages;
CREATE POLICY "Send group messages"
  ON group_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_group_member(auth.uid(), group_id)
  );

-- Helper RPCs
CREATE OR REPLACE FUNCTION public.list_groups_with_counts()
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  visibility group_visibility,
  created_at TIMESTAMPTZ,
  member_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id,
    g.name,
    g.description,
    g.visibility,
    g.created_at,
    COUNT(m.user_id) AS member_count
  FROM community_groups g
  LEFT JOIN group_members m ON m.group_id = g.id
  GROUP BY g.id
  ORDER BY g.name;
$$;

GRANT EXECUTE ON FUNCTION public.list_groups_with_counts TO authenticated;

CREATE OR REPLACE FUNCTION public.list_group_memberships(_user_id UUID)
RETURNS TABLE (
  group_id UUID,
  role group_member_role
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT group_id, role
  FROM group_members
  WHERE user_id = _user_id;
$$;

GRANT EXECUTE ON FUNCTION public.list_group_memberships(UUID) TO authenticated;
