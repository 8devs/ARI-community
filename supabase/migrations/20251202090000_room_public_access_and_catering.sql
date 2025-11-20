-- Enable booking-level catering info and allow anonymous public room lookups
alter table public.room_bookings
  add column if not exists requires_catering boolean not null default false,
  add column if not exists catering_details text;

drop function if exists public.get_room_public_details(uuid);
create function public.get_room_public_details(p_token uuid)
returns table (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  name text,
  location text,
  description text,
  capacity integer,
  equipment text,
  is_active boolean,
  organization_id uuid,
  resource_group_id uuid,
  chairs_capacity integer,
  chairs_default integer,
  tables_capacity integer,
  tables_default integer,
  requires_beverage_catering boolean,
  notify_on_booking boolean,
  booking_notify_email text,
  info_document_url text,
  public_share_token uuid,
  organization_name text
)
language sql
security definer
set search_path = public
as $$
  select
    r.id,
    r.created_at,
    r.updated_at,
    r.name,
    r.location,
    r.description,
    r.capacity,
    r.equipment,
    r.is_active,
    r.organization_id,
    r.resource_group_id,
    r.chairs_capacity,
    r.chairs_default,
    r.tables_capacity,
    r.tables_default,
    r.requires_beverage_catering,
    r.notify_on_booking,
    r.booking_notify_email,
    r.info_document_url,
    r.public_share_token,
    o.name as organization_name
  from public.rooms r
  left join public.organizations o on o.id = r.organization_id
  where r.public_share_token = p_token
$$;

grant execute on function public.get_room_public_details(uuid) to anon, authenticated;

drop function if exists public.get_room_public_bookings(uuid);
create function public.get_room_public_bookings(p_token uuid)
returns table (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  room_id uuid,
  start_time timestamptz,
  end_time timestamptz,
  title text,
  description text,
  expected_attendees integer,
  chairs_needed integer,
  tables_needed integer,
  whiteboards_needed integer,
  created_by uuid,
  organization_id uuid,
  requires_catering boolean,
  catering_details text,
  creator_name text
)
language sql
security definer
set search_path = public
as $$
  select
    b.id,
    b.created_at,
    b.updated_at,
    b.room_id,
    b.start_time,
    b.end_time,
    b.title,
    b.description,
    b.expected_attendees,
    b.chairs_needed,
    b.tables_needed,
    b.whiteboards_needed,
    b.created_by,
    b.organization_id,
    b.requires_catering,
    b.catering_details,
    p.name as creator_name
  from public.room_bookings b
  join public.rooms r on r.id = b.room_id
  left join public.profiles p on p.id = b.created_by
  where r.public_share_token = p_token
  order by b.start_time
$$;

grant execute on function public.get_room_public_bookings(uuid) to anon, authenticated;
