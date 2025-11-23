-- Task enums
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'reception_task_direction'
  ) THEN
    CREATE TYPE reception_task_direction AS ENUM ('ORG_TODO', 'USER_NOTE');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'reception_task_status'
  ) THEN
    CREATE TYPE reception_task_status AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');
  END IF;
END
$$;

-- Reception task tables
CREATE TABLE IF NOT EXISTS public.reception_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  details TEXT,
  direction reception_task_direction NOT NULL DEFAULT 'USER_NOTE',
  status reception_task_status NOT NULL DEFAULT 'OPEN',
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  assigned_reception_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reception_task_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.reception_tasks(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  entry TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.touch_reception_task_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_reception_task_updated_at ON public.reception_tasks;
CREATE TRIGGER trg_touch_reception_task_updated_at
  BEFORE UPDATE ON public.reception_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_reception_task_updated_at();

ALTER TABLE public.reception_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reception_task_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reception tasks readable"
  ON public.reception_tasks
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR assigned_reception_id = auth.uid()
    OR public.has_role(auth.uid(), 'RECEPTION')
    OR public.has_role(auth.uid(), 'SUPER_ADMIN')
    OR public.has_role(auth.uid(), 'ORG_ADMIN')
  );

CREATE POLICY "Reception tasks insert"
  ON public.reception_tasks
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      direction = 'USER_NOTE'
      OR public.has_role(auth.uid(), 'RECEPTION')
      OR public.has_role(auth.uid(), 'SUPER_ADMIN')
      OR public.has_role(auth.uid(), 'ORG_ADMIN')
    )
  );

CREATE POLICY "Reception tasks update"
  ON public.reception_tasks
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR assigned_reception_id = auth.uid()
    OR public.has_role(auth.uid(), 'RECEPTION')
    OR public.has_role(auth.uid(), 'SUPER_ADMIN')
    OR public.has_role(auth.uid(), 'ORG_ADMIN')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR assigned_reception_id = auth.uid()
    OR public.has_role(auth.uid(), 'RECEPTION')
    OR public.has_role(auth.uid(), 'SUPER_ADMIN')
    OR public.has_role(auth.uid(), 'ORG_ADMIN')
  );

CREATE POLICY "Reception tasks delete"
  ON public.reception_tasks
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'RECEPTION')
    OR public.has_role(auth.uid(), 'SUPER_ADMIN')
    OR public.has_role(auth.uid(), 'ORG_ADMIN')
  );

CREATE POLICY "Reception task logs readable"
  ON public.reception_task_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.reception_tasks t
      WHERE t.id = task_id
        AND (
          t.created_by = auth.uid()
          OR t.assigned_reception_id = auth.uid()
          OR public.has_role(auth.uid(), 'RECEPTION')
          OR public.has_role(auth.uid(), 'SUPER_ADMIN')
          OR public.has_role(auth.uid(), 'ORG_ADMIN')
        )
    )
  );

CREATE POLICY "Reception task logs insert"
  ON public.reception_task_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.reception_tasks t
      WHERE t.id = task_id
        AND (
          t.created_by = auth.uid()
          OR t.assigned_reception_id = auth.uid()
          OR public.has_role(auth.uid(), 'RECEPTION')
          OR public.has_role(auth.uid(), 'SUPER_ADMIN')
          OR public.has_role(auth.uid(), 'ORG_ADMIN')
        )
    )
  );

CREATE POLICY "Reception task logs delete"
  ON public.reception_task_logs
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'RECEPTION')
    OR public.has_role(auth.uid(), 'SUPER_ADMIN')
    OR public.has_role(auth.uid(), 'ORG_ADMIN')
    OR created_by = auth.uid()
  );

-- Allow reception members to be treated as group admins when necessary
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
  )
  OR public.has_role(_user_id, 'SUPER_ADMIN')
  OR public.has_role(_user_id, 'ORG_ADMIN');
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
  )
  OR public.has_role(_user_id, 'SUPER_ADMIN')
  OR public.has_role(_user_id, 'ORG_ADMIN');
$$;
