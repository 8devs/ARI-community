create or replace function public.set_timestamps()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if tg_op = 'INSERT' and new.created_at is null then
    new.created_at = now();
  end if;
  return new;
end;
$$;

create table if not exists public.room_resource_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  tables_total integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_timestamp_room_resource_groups
before update on public.room_resource_groups
for each row execute procedure public.set_timestamps();

alter table public.rooms
  add column resource_group_id uuid references public.room_resource_groups(id) on delete set null;

create index if not exists room_resource_groups_org_idx on public.room_resource_groups(organization_id);
create index if not exists rooms_resource_group_idx on public.rooms(resource_group_id);
