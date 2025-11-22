-- Step 1: introduce custom auth tables without touching existing profile rows
create table if not exists public.app_users (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  password_hash text not null,
  role app_role not null default 'MEMBER',
  organization_id uuid references public.organizations(id),
  name text,
  is_email_verified boolean not null default false,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.app_users is 'Application-managed users replacing auth.users';
comment on column public.app_users.password_hash is 'BCrypt/Argon2 hash managed by custom auth service';

alter table public.app_users
  add constraint app_users_email_check check (position('@' in email) > 1);

create table if not exists public.auth_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  token_hash text not null,
  token_type text not null check (token_type in ('RESET_PASSWORD', 'EMAIL_VERIFY', 'INVITE')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auth_tokens_user_id_idx on public.auth_tokens(user_id);
create index if not exists auth_tokens_token_hash_idx on public.auth_tokens(token_hash);

alter table public.employee_invitations
  add column if not exists is_news_manager boolean not null default false,
  add column if not exists is_event_manager boolean not null default false;
