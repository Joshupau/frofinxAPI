-- `spent` is a plain stored column, kept in sync by the budgets_* RPCs (it's
-- recomputed live from transactions on every read in the original Mongoose
-- service, not a true running total) — see 0016_rpc_budgets.sql.
-- `remaining`/`percentage_spent` mirror the two Mongoose virtuals and are
-- safe as generated columns since they're pure same-row arithmetic.
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id),
  name text not null,
  amount numeric(14, 2) not null,
  spent numeric(14, 2) not null default 0,
  period budget_period not null default 'monthly',
  start_date timestamptz not null,
  end_date timestamptz not null,
  status budget_status not null default 'active',
  alert_threshold numeric(5, 2) default 80,
  remaining numeric(14, 2) generated always as (amount - spent) stored,
  percentage_spent numeric(7, 2) generated always as (
    case when amount > 0 then (spent / amount) * 100 else 0 end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index budgets_owner_startdate_enddate_idx on public.budgets (owner_id, start_date, end_date);
create index budgets_owner_category_status_idx on public.budgets (owner_id, category_id, status);

create trigger set_budgets_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();
