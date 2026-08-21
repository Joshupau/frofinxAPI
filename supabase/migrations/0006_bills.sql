-- obligation_id has no FK constraint here (obligations doesn't exist yet —
-- obligations rows are created before their installment bills reference
-- them, so this FK is added in 0008_obligations.sql once obligations exists).
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  type bill_type not null default 'bill',
  name text not null,
  amount numeric(14, 2) not null,
  category_id uuid references public.categories(id),
  due_date timestamptz not null,
  is_recurring boolean not null default false,
  recurring_frequency recurring_frequency,
  payment_status bill_payment_status not null default 'unpaid',
  paid_amount numeric(14, 2) default 0,
  wallet_id uuid references public.wallets(id),
  reminder boolean not null default true,
  reminder_days integer default 3,
  notes text,
  status record_status not null default 'active',
  last_paid_date timestamptz,
  next_due_date timestamptz,
  parent_bill_id uuid references public.bills(id),
  transaction_id uuid references public.transactions(id),
  obligation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bills_owner_type_duedate_paymentstatus_idx on public.bills (owner_id, type, due_date, payment_status);
create index bills_owner_type_recurring_status_idx on public.bills (owner_id, type, is_recurring, status);
create index bills_owner_type_status_paymentstatus_idx on public.bills (owner_id, type, status, payment_status);
create index bills_obligation_id_idx on public.bills (obligation_id);

create trigger set_bills_updated_at
  before update on public.bills
  for each row execute function public.set_updated_at();

alter table public.transactions
  add constraint transactions_bill_id_fkey foreign key (bill_id) references public.bills(id);
