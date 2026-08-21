create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type wallet_type not null default 'cash',
  balance numeric(14, 2) not null default 0,
  currency text not null default 'PHP',
  icon text,
  color text,
  description text,
  account_number text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index wallets_owner_status_idx on public.wallets (owner_id, status);

create trigger set_wallets_updated_at
  before update on public.wallets
  for each row execute function public.set_updated_at();

-- owner_id nullable: null = global/default category shared by every user.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  type category_type not null,
  icon text,
  color text,
  is_default boolean not null default false,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_owner_type_status_idx on public.categories (owner_id, type, status);

create trigger set_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();
