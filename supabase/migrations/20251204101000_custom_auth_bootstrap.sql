-- Custom auth bootstrap step 2: link profiles to app_users
alter table public.profiles
  add column if not exists local_user_id uuid references public.app_users(id);

update public.profiles
  set local_user_id = id
  where local_user_id is null;

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  add constraint profiles_id_fkey foreign key (id) references public.app_users(id) on delete cascade;

create index if not exists profiles_local_user_idx on public.profiles(local_user_id);
