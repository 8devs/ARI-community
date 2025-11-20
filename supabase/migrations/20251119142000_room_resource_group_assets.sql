alter table public.room_resource_groups
  add column chairs_total integer,
  add column whiteboards_total integer;

alter table public.room_bookings
  add column whiteboards_needed integer;
