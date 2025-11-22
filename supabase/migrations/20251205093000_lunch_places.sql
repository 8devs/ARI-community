-- Lunch places catalogue and reviews
create table if not exists public.lunch_places (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  website_url text,
  phone text,
  contact_email text,
  address text not null,
  cuisine text,
  distance_minutes integer,
  opening_hours text,
  menu_url text,
  latitude numeric,
  longitude numeric,
  created_by uuid not null references public.profiles(id),
  last_reviewed_at timestamptz
);

create table if not exists public.lunch_reviews (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  place_id uuid not null references public.lunch_places(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  wait_time_minutes integer,
  comment text
);

create index if not exists lunch_places_created_by_idx on public.lunch_places(created_by);
create index if not exists lunch_reviews_place_idx on public.lunch_reviews(place_id);
create unique index if not exists lunch_reviews_unique_user_place_idx on public.lunch_reviews(place_id, user_id);

create or replace function public.lunch_places_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lunch_places_updated_at on public.lunch_places;
create trigger trg_lunch_places_updated_at
before update on public.lunch_places
for each row execute function public.lunch_places_updated_at();

alter table public.lunch_places enable row level security;
alter table public.lunch_reviews enable row level security;

-- Everyone signed in can view places
create policy "Lunch places readable" on public.lunch_places
for select
using (auth.role() = 'authenticated');

-- Everyone signed in can create a place
create policy "Users can insert lunch places" on public.lunch_places
for insert
with check (
  auth.role() = 'authenticated'
  and created_by = auth.uid()
);

-- Owners can update their place, admins manage all
create policy "Owners can update their lunch places" on public.lunch_places
for update
using (
  created_by = auth.uid()
  or public.has_role(auth.uid(), 'SUPER_ADMIN')
  or public.has_role(auth.uid(), 'ORG_ADMIN')
)
with check (
  created_by = auth.uid()
  or public.has_role(auth.uid(), 'SUPER_ADMIN')
  or public.has_role(auth.uid(), 'ORG_ADMIN')
);

create policy "Admins can delete lunch places" on public.lunch_places
for delete
using (
  public.has_role(auth.uid(), 'SUPER_ADMIN')
  or public.has_role(auth.uid(), 'ORG_ADMIN')
);

-- Reviews
create policy "Lunch reviews readable" on public.lunch_reviews
for select
using (auth.role() = 'authenticated');

create policy "Users insert lunch reviews" on public.lunch_reviews
for insert
with check (
  auth.role() = 'authenticated'
  and user_id = auth.uid()
);

create policy "Users update own lunch reviews" on public.lunch_reviews
for update
using (
  user_id = auth.uid()
  or public.has_role(auth.uid(), 'SUPER_ADMIN')
  or public.has_role(auth.uid(), 'ORG_ADMIN')
)
with check (
  user_id = auth.uid()
  or public.has_role(auth.uid(), 'SUPER_ADMIN')
  or public.has_role(auth.uid(), 'ORG_ADMIN')
);

create policy "Users delete own lunch reviews" on public.lunch_reviews
for delete
using (
  user_id = auth.uid()
  or public.has_role(auth.uid(), 'SUPER_ADMIN')
  or public.has_role(auth.uid(), 'ORG_ADMIN')
);
