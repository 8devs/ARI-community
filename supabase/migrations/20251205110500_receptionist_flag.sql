-- Receptionist flag on profiles
alter table public.profiles
  add column if not exists is_receptionist boolean not null default false;

-- Helper to check receptionist permission in RLS
create or replace function public.is_receptionist(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_receptionist from public.profiles where id = _user_id),
    false
  );
$$;

create or replace function public.is_member_of_org(_user_id uuid, _organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = _user_id
      and organization_id = _organization_id
  );
$$;

-- Update reception task policies to rely on the new flag
drop policy if exists "Reception tasks readable" on public.reception_tasks;
drop policy if exists "Reception tasks insert" on public.reception_tasks;
drop policy if exists "Reception tasks update" on public.reception_tasks;
drop policy if exists "Reception tasks delete" on public.reception_tasks;

create policy "Reception tasks readable"
  on public.reception_tasks
  for select
  using (
    created_by = auth.uid()
    or assigned_reception_id = auth.uid()
    or public.is_receptionist(auth.uid())
    or (
      direction = 'ORG_TODO'
      and organization_id is not null
      and public.is_member_of_org(auth.uid(), organization_id)
    )
  );

create policy "Reception tasks insert"
  on public.reception_tasks
  for insert
  with check (
    created_by = auth.uid()
    and (
      direction = 'USER_NOTE'
      or public.is_receptionist(auth.uid())
    )
  );

create policy "Reception tasks update"
  on public.reception_tasks
  for update
  using (
    public.is_receptionist(auth.uid())
  )
  with check (
    public.is_receptionist(auth.uid())
  );

create policy "Reception tasks delete"
  on public.reception_tasks
  for delete
  using (
    public.is_receptionist(auth.uid())
  );

drop policy if exists "Reception task logs readable" on public.reception_task_logs;
drop policy if exists "Reception task logs insert" on public.reception_task_logs;
drop policy if exists "Reception task logs delete" on public.reception_task_logs;

create policy "Reception task logs readable"
  on public.reception_task_logs
  for select
  using (
    exists (
      select 1
      from public.reception_tasks t
      where t.id = task_id
        and (
          t.created_by = auth.uid()
          or public.is_receptionist(auth.uid())
          or (
            t.direction = 'ORG_TODO'
            and t.organization_id is not null
            and public.is_member_of_org(auth.uid(), t.organization_id)
          )
        )
    )
  );

create policy "Reception task logs insert"
  on public.reception_task_logs
  for insert
  with check (
    exists (
      select 1
      from public.reception_tasks t
      where t.id = task_id
        and public.is_receptionist(auth.uid())
    )
  );

create policy "Reception task logs delete"
  on public.reception_task_logs
  for delete
  using (
    public.is_receptionist(auth.uid())
    or created_by = auth.uid()
  );
