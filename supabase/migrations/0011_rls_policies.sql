-- RLS policy shapes, per the migration plan:
--   * owner-scoped tables: owner_id = auth.uid() AND profile is active
--   * categories: select also allows owner_id IS NULL (global categories)
--   * investment_value_snapshots: derived from the parent investment's owner
--   * finance_agent_cache: select-only for the client, writes via service role
--   * staff_users / global_passwords / global_pass_usage / maintenance:
--     RLS enabled with ZERO policies — only reachable via Edge Functions
--     using the service_role key, which bypasses RLS entirely. `profiles`
--     needs no insert policy either: it's populated only by the
--     SECURITY DEFINER handle_new_user() trigger, which runs as the
--     function owner and bypasses RLS.

alter table public.profiles enable row level security;
alter table public.user_details enable row level security;
alter table public.wallets enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.bills enable row level security;
alter table public.budgets enable row level security;
alter table public.obligations enable row level security;
alter table public.investments enable row level security;
alter table public.investment_value_snapshots enable row level security;
alter table public.finance_agent_cache enable row level security;
alter table public.staff_users enable row level security;
alter table public.global_passwords enable row level security;
alter table public.global_pass_usage enable row level security;
alter table public.maintenance enable row level security;

-- profiles
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- user_details
create policy user_details_all_own on public.user_details
  for all
  using (owner_id = auth.uid() and public.profile_is_active())
  with check (owner_id = auth.uid() and public.profile_is_active());

-- wallets
create policy wallets_all_own on public.wallets
  for all
  using (owner_id = auth.uid() and public.profile_is_active())
  with check (owner_id = auth.uid() and public.profile_is_active());

-- categories: global (owner_id null) rows are shared-read, never writable
-- by regular users.
create policy categories_select_own_or_global on public.categories
  for select using (owner_id is null or owner_id = auth.uid());
create policy categories_insert_own on public.categories
  for insert with check (owner_id = auth.uid() and public.profile_is_active());
create policy categories_update_own on public.categories
  for update
  using (owner_id = auth.uid() and public.profile_is_active())
  with check (owner_id = auth.uid() and public.profile_is_active());
create policy categories_delete_own on public.categories
  for delete using (owner_id = auth.uid() and public.profile_is_active());

-- transactions (writes mostly happen through SECURITY INVOKER RPCs, which
-- are still subject to these same policies as the calling user)
create policy transactions_all_own on public.transactions
  for all
  using (owner_id = auth.uid() and public.profile_is_active())
  with check (owner_id = auth.uid() and public.profile_is_active());

-- bills
create policy bills_all_own on public.bills
  for all
  using (owner_id = auth.uid() and public.profile_is_active())
  with check (owner_id = auth.uid() and public.profile_is_active());

-- budgets
create policy budgets_all_own on public.budgets
  for all
  using (owner_id = auth.uid() and public.profile_is_active())
  with check (owner_id = auth.uid() and public.profile_is_active());

-- obligations
create policy obligations_all_own on public.obligations
  for all
  using (owner_id = auth.uid() and public.profile_is_active())
  with check (owner_id = auth.uid() and public.profile_is_active());

-- investments
create policy investments_all_own on public.investments
  for all
  using (owner_id = auth.uid() and public.profile_is_active())
  with check (owner_id = auth.uid() and public.profile_is_active());

-- investment_value_snapshots: no owner_id of its own, derive from parent
create policy investment_value_snapshots_all_own on public.investment_value_snapshots
  for all
  using (
    exists (
      select 1 from public.investments i
      where i.id = investment_id and i.owner_id = auth.uid()
    ) and public.profile_is_active()
  )
  with check (
    exists (
      select 1 from public.investments i
      where i.id = investment_id and i.owner_id = auth.uid()
    ) and public.profile_is_active()
  );

-- finance_agent_cache: client may read its own cached insights; only the
-- finance-insight Edge Function (service_role) writes here.
create policy finance_agent_cache_select_own on public.finance_agent_cache
  for select using (owner_id = auth.uid());

-- staff_users / global_passwords / global_pass_usage / maintenance:
-- RLS enabled above with no policies at all — intentionally unreachable
-- from anon/authenticated roles.
