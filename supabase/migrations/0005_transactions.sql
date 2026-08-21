-- bill_id has no FK constraint here (bills doesn't exist yet — bills also
-- references transactions via transaction_id, so the cycle is broken by
-- adding this FK in 0006_bills.sql once the bills table exists).
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id),
  category_id uuid references public.categories(id),
  amount numeric(14, 2) not null,
  type transaction_type not null,
  description text,
  date timestamptz not null,
  attachments text[] not null default '{}',
  bill_id uuid,
  tags text[] not null default '{}',
  to_wallet_id uuid references public.wallets(id),
  service_fee numeric(14, 2) not null default 0,
  service_fee_deducted boolean not null default false,
  idempotency_key text,
  status transaction_status not null default 'completed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_owner_date_idx on public.transactions (owner_id, date desc);
create index transactions_owner_wallet_status_idx on public.transactions (owner_id, wallet_id, status);
create index transactions_owner_category_date_idx on public.transactions (owner_id, category_id, date desc);
create index transactions_owner_type_date_idx on public.transactions (owner_id, type, date desc);
create index transactions_owner_idempotency_idx on public.transactions (owner_id, idempotency_key, created_at desc)
  where idempotency_key is not null;

create trigger set_transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();
