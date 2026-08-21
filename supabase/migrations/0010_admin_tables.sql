-- Everything in this file is deliberately outside Supabase Auth and RLS-open
-- to no one (see 0011_rls_policies.sql) — only Edge Functions running with
-- the service_role key may touch these tables. No FK to profiles/auth.users.

create table public.staff_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  status text not null default 'active',
  role text not null default 'admin',
  webtoken text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_staff_users_updated_at
  before update on public.staff_users
  for each row execute function public.set_updated_at();

create table public.global_passwords (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id),
  passcode_hash text not null,
  status boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_global_passwords_updated_at
  before update on public.global_passwords
  for each row execute function public.set_updated_at();

-- user_id intentionally has no FK: it refers to either a profiles row
-- (player) or a staff_users row (admin) depending on user_type, matching the
-- original Mongo model which never enforced referential integrity here.
create table public.global_pass_usage (
  id uuid primary key default gen_random_uuid(),
  pass_id uuid not null references public.global_passwords(id),
  ip_address text not null,
  user_id uuid not null,
  user_type text not null check (user_type in ('player', 'Staffusers')),
  created_at timestamptz not null default now()
);

create index global_pass_usage_created_at_idx on public.global_pass_usage (created_at desc);

create table public.maintenance (
  id uuid primary key default gen_random_uuid(),
  type text not null unique,
  value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_maintenance_updated_at
  before update on public.maintenance
  for each row execute function public.set_updated_at();

-- Daily AI-insight cache. `category_key` stays plain text (in the original
-- Mongo model it was a stringified id pulled out of an aggregation result,
-- not a true FK — fixing the `ref: 'User'/'Wallet'` mismatch bug here for
-- free since real FKs are used instead of loose ref strings).
create table public.finance_agent_cache (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  wallet_id uuid references public.wallets(id),
  category_key text not null,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index finance_agent_cache_owner_category_created_idx
  on public.finance_agent_cache (owner_id, category_key, created_at desc);

create trigger set_finance_agent_cache_updated_at
  before update on public.finance_agent_cache
  for each row execute function public.set_updated_at();
