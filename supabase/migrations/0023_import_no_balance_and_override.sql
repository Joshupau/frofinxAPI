-- transactions_bulk_import: imported transactions are inserted as-is but no
-- longer move the wallet balance. Imports commonly land on top of a wallet
-- whose balance already reflects the imported history some other way (a
-- prior manual entry, a bank's stated balance, etc.), so auto-applying the
-- net delta silently double-counts. Balance now only moves through
-- transactions_create/_delete (organic entry) or wallets_set_balance below
-- (manual reconciliation).
create or replace function public.transactions_bulk_import(
  p_wallet_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_wallet public.wallets;
  v_inserted integer;
begin
  select * into v_wallet from public.wallets
  where id = p_wallet_id and owner_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'Wallet not found or inactive.' using errcode = 'P0002';
  end if;

  with rows as (
    select *
    from jsonb_to_recordset(p_rows) as r(
      date timestamptz,
      amount numeric,
      type transaction_type,
      description text,
      tags text[],
      category_id uuid
    )
  ),
  inserted as (
    insert into public.transactions (
      owner_id, wallet_id, amount, type, description, date, tags, category_id, attachments, status
    )
    select auth.uid(), p_wallet_id, amount, type, description, date,
           coalesce(tags, '{}'), category_id, '{}', 'completed'
    from rows
    returning 1
  )
  select count(*) into v_inserted from inserted;

  return jsonb_build_object('imported', v_inserted);
end;
$$;

grant execute on function public.transactions_bulk_import(uuid, jsonb) to authenticated;

-- wallets_set_balance: manual override of a wallet's balance, distinct from
-- wallets_adjust_balance (which applies a delta). Needed now that imports no
-- longer touch balance — this is how a user reconciles the wallet's balance
-- against reality (e.g. their bank's stated balance) after an import.
create or replace function public.wallets_set_balance(
  p_wallet_id uuid,
  p_balance numeric
)
returns public.wallets
language plpgsql
as $$
declare
  v_wallet public.wallets;
begin
  update public.wallets
  set balance = p_balance
  where id = p_wallet_id
    and owner_id = auth.uid()
    and status = 'active'
  returning * into v_wallet;

  if not found then
    raise exception 'Wallet not found or inactive.' using errcode = 'P0002';
  end if;

  return v_wallet;
end;
$$;

grant execute on function public.wallets_set_balance(uuid, numeric) to authenticated;
