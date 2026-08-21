-- transactions_create: mirrors transactions.service.ts#create — wraps the
-- transaction insert + wallet balance mutation(s) + optional bill linkage +
-- optional fee-bill spinoff in a single atomic call (the original Mongoose
-- version only sequenced `.save()`s with no real transaction).
create or replace function public.transactions_create(
  p_wallet_id uuid,
  p_amount numeric,
  p_type transaction_type,
  p_category_id uuid default null,
  p_description text default null,
  p_date timestamptz default now(),
  p_attachments text[] default '{}',
  p_tags text[] default '{}',
  p_to_wallet_id uuid default null,
  p_bill_id uuid default null,
  p_service_fee numeric default 0,
  p_create_bill_for_fee boolean default false
)
returns public.transactions
language plpgsql
as $$
declare
  v_wallet public.wallets;
  v_to_wallet public.wallets;
  v_immediate_fee numeric := 0;
  v_total_deduction numeric;
  v_fee_deducted boolean := false;
  v_txn public.transactions;
  v_fee_due_date timestamptz;
  v_fee_txn public.transactions;
begin
  select * into v_wallet from public.wallets
  where id = p_wallet_id and owner_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'Wallet not found or inactive.' using errcode = 'P0002';
  end if;

  if p_type = 'transfer' then
    if p_to_wallet_id is null then
      raise exception 'Destination wallet required for transfers.' using errcode = 'P0001';
    end if;
    if p_wallet_id = p_to_wallet_id then
      raise exception 'Cannot transfer to the same wallet.' using errcode = 'P0001';
    end if;
    select * into v_to_wallet from public.wallets
    where id = p_to_wallet_id and owner_id = auth.uid() and status = 'active';
    if not found then
      raise exception 'Destination wallet not found or inactive.' using errcode = 'P0002';
    end if;
  end if;

  v_immediate_fee := case when not p_create_bill_for_fee and p_service_fee > 0 then p_service_fee else 0 end;
  v_total_deduction := case when p_type = 'transfer' then p_amount + v_immediate_fee else p_amount end;

  if p_type in ('expense', 'transfer') and v_wallet.balance < v_total_deduction then
    raise exception 'Insufficient wallet balance for transaction%',
      case when v_immediate_fee > 0 then ' and service fee.' else '.' end
      using errcode = 'P0001';
  end if;

  v_fee_deducted := (p_type = 'transfer' and p_service_fee > 0 and not p_create_bill_for_fee);

  insert into public.transactions (
    owner_id, wallet_id, category_id, amount, type, description, date,
    attachments, tags, to_wallet_id, bill_id, service_fee, service_fee_deducted, status
  ) values (
    auth.uid(), p_wallet_id, p_category_id, p_amount, p_type, p_description, p_date,
    p_attachments, p_tags, p_to_wallet_id, p_bill_id, p_service_fee, v_fee_deducted, 'completed'
  )
  returning * into v_txn;

  if p_type = 'income' then
    update public.wallets set balance = balance + p_amount where id = p_wallet_id;
  elsif p_type = 'expense' then
    update public.wallets set balance = balance - p_amount where id = p_wallet_id;
  elsif p_type = 'transfer' then
    update public.wallets set balance = balance - (p_amount + case when v_fee_deducted then p_service_fee else 0 end)
      where id = p_wallet_id;
    update public.wallets set balance = balance + p_amount where id = p_to_wallet_id;
  end if;

  if p_bill_id is not null then
    update public.bills
    set payment_status = 'paid', paid_amount = p_amount, last_paid_date = v_txn.date
    where id = p_bill_id and owner_id = auth.uid();
  end if;

  if p_create_bill_for_fee and p_service_fee > 0 then
    v_fee_due_date := v_txn.date + interval '1 day';

    insert into public.transactions (
      owner_id, wallet_id, amount, type, description, date, attachments, tags, status
    ) values (
      auth.uid(), p_wallet_id, p_service_fee, 'expense',
      format('Service fee for transfer of %s', p_amount), v_fee_due_date, '{}', '{}', 'pending'
    )
    returning * into v_fee_txn;

    insert into public.bills (
      owner_id, name, amount, due_date, is_recurring, wallet_id, reminder,
      payment_status, notes, status, transaction_id
    ) values (
      auth.uid(), 'Transfer Service Fee', p_service_fee, v_fee_due_date, false, p_wallet_id, false,
      'unpaid', format('Service fee for transfer transaction ID: %s', v_txn.id), 'active', v_fee_txn.id
    );
  end if;

  return v_txn;
end;
$$;

grant execute on function public.transactions_create(
  uuid, numeric, transaction_type, uuid, text, timestamptz, text[], text[], uuid, uuid, numeric, boolean
) to authenticated;

-- transactions_update: mirrors transactions.service.ts#update — amount,
-- type, and wallet are structurally excluded from this signature (the
-- original service explicitly rejects changing them; here it's simply not
-- possible to pass them).
create or replace function public.transactions_update(
  p_id uuid,
  p_category_id uuid default null,
  p_description text default null,
  p_date timestamptz default null,
  p_attachments text[] default null,
  p_tags text[] default null,
  p_status transaction_status default null
)
returns public.transactions
language plpgsql
as $$
declare
  v_txn public.transactions;
begin
  update public.transactions
  set
    category_id = coalesce(p_category_id, category_id),
    description = coalesce(p_description, description),
    date = coalesce(p_date, date),
    attachments = coalesce(p_attachments, attachments),
    tags = coalesce(p_tags, tags),
    status = coalesce(p_status, status)
  where id = p_id and owner_id = auth.uid()
  returning * into v_txn;

  if not found then
    raise exception 'Transaction not found or you do not have permission.' using errcode = 'P0002';
  end if;

  return v_txn;
end;
$$;

grant execute on function public.transactions_update(uuid, uuid, text, timestamptz, text[], text[], transaction_status) to authenticated;

-- transactions_delete: mirrors transactions.service.ts#deleteTransaction —
-- reverses the balance math (including any deducted service fee) before
-- removing the row.
create or replace function public.transactions_delete(p_id uuid)
returns void
language plpgsql
as $$
declare
  v_txn public.transactions;
begin
  select * into v_txn from public.transactions
  where id = p_id and owner_id = auth.uid();

  if not found then
    raise exception 'Transaction not found or you do not have permission.' using errcode = 'P0002';
  end if;

  if v_txn.status <> 'completed' then
    raise exception 'Can only delete completed transactions.' using errcode = 'P0001';
  end if;

  if v_txn.type = 'income' then
    update public.wallets set balance = balance - v_txn.amount where id = v_txn.wallet_id;
  elsif v_txn.type = 'expense' then
    update public.wallets set balance = balance + v_txn.amount where id = v_txn.wallet_id;
  elsif v_txn.type = 'transfer' and v_txn.to_wallet_id is not null then
    update public.wallets
    set balance = balance + v_txn.amount + case when v_txn.service_fee_deducted then v_txn.service_fee else 0 end
    where id = v_txn.wallet_id;
    update public.wallets set balance = balance - v_txn.amount where id = v_txn.to_wallet_id;
  end if;

  delete from public.transactions where id = p_id;
end;
$$;

grant execute on function public.transactions_delete(uuid) to authenticated;

-- transactions_bulk_import: mirrors transactions.service.ts#importTransactions
-- (the DB half — CSV text parsing happens in the import-transactions Edge
-- Function, which calls this with already-parsed rows). Bulk inserts, then
-- applies one net balance delta, all atomically.
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
  v_income_total numeric;
  v_expense_total numeric;
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
    returning amount, type
  )
  select
    count(*),
    coalesce(sum(amount) filter (where type = 'income'), 0),
    coalesce(sum(amount) filter (where type = 'expense'), 0)
  into v_inserted, v_income_total, v_expense_total
  from inserted;

  update public.wallets
  set balance = balance + v_income_total - v_expense_total
  where id = p_wallet_id;

  return jsonb_build_object('imported', v_inserted);
end;
$$;

grant execute on function public.transactions_bulk_import(uuid, jsonb) to authenticated;
