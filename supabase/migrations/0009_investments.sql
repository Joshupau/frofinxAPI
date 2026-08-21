create table public.investments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type investment_type not null,
  principal_amount numeric(14, 2) not null,
  current_value numeric(14, 2) not null,
  currency text not null default 'PHP',
  platform text,
  wallet_id uuid references public.wallets(id),
  category_id uuid references public.categories(id),
  start_date timestamptz not null,
  maturity_date timestamptz,
  expected_return_rate numeric(7, 4),
  dividends_received numeric(14, 2) not null default 0,
  notes text,
  tags text[] not null default '{}',
  status investment_status not null default 'active',
  funding_transaction_id uuid references public.transactions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index investments_owner_type_status_idx on public.investments (owner_id, type, status);
create index investments_owner_status_startdate_idx on public.investments (owner_id, status, start_date desc);

create trigger set_investments_updated_at
  before update on public.investments
  for each row execute function public.set_updated_at();

-- Mongoose's embedded `valueHistory[]` (unbounded, timestamp-ordered append
-- log) promoted to a child table rather than jsonb — it benefits from being
-- independently queryable/paginated.
create table public.investment_value_snapshots (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null references public.investments(id) on delete cascade,
  value numeric(14, 2) not null,
  snapshot_date timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);

create index investment_value_snapshots_investment_date_idx
  on public.investment_value_snapshots (investment_id, snapshot_date);
