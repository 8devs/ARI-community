alter table public.lunch_places
  add column if not exists open_days text[] default array[]::text[];
