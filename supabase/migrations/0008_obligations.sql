-- The Mongoose `bills[]` array on Obligations becomes a reverse FK: it's a
-- proper one-to-many, so bills.obligation_id is the relation, not an array
-- column here.
create table public.obligations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  direction obligation_direction not null,
  name text not null,
  counterparty text not null,
  counterparty_contact text,
  principal_amount numeric(14, 2) not null,
  remaining_balance numeric(14, 2) not null,
  currency text not null default 'PHP',
  interest_rate numeric(7, 4),
  interest_type interest_type,
  total_with_interest numeric(14, 2),
  start_date timestamptz not null,
  due_date timestamptz,
  wallet_id uuid references public.wallets(id),
  category_id uuid references public.categories(id),
  notes text,
  tags text[] not null default '{}',
  status obligation_status not null default 'active',
  is_installment boolean not null default false,
  installment_amount numeric(14, 2),
  total_installments integer,
  paid_installments integer not null default 0,
  installment_frequency installment_frequency,
  disbursement_transaction_id uuid references public.transactions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index obligations_owner_direction_status_idx on public.obligations (owner_id, direction, status);
create index obligations_owner_installment_status_idx on public.obligations (owner_id, is_installment, status);
create index obligations_owner_duedate_status_idx on public.obligations (owner_id, due_date, status);

create trigger set_obligations_updated_at
  before update on public.obligations
  for each row execute function public.set_updated_at();

alter table public.bills
  add constraint bills_obligation_id_fkey foreign key (obligation_id) references public.obligations(id);
