-- obligations_create: mirrors obligations.service.ts#create — disbursement
-- transaction + wallet balance update, and (for installment obligations)
-- auto-generated installment Bills + linked pending Transactions, all atomic.
create or replace function public.obligations_create(
  p_direction obligation_direction,
  p_name text,
  p_counterparty text,
  p_principal_amount numeric,
  p_start_date timestamptz,
  p_counterparty_contact text default null,
  p_currency text default 'PHP',
  p_interest_rate numeric default null,
  p_interest_type interest_type default null,
  p_due_date timestamptz default null,
  p_wallet_id uuid default null,
  p_category_id uuid default null,
  p_notes text default null,
  p_tags text[] default '{}',
  p_is_installment boolean default false,
  p_installment_amount numeric default null,
  p_total_installments integer default null,
  p_installment_frequency installment_frequency default null
)
returns public.obligations
language plpgsql
as $$
declare
  v_total_with_interest numeric;
  v_obligation public.obligations;
  v_wallet public.wallets;
  v_disbursement_tx public.transactions;
  v_due_dates timestamptz[];
  v_due_date timestamptz;
  v_bill public.bills;
  v_txn public.transactions;
begin
  if p_is_installment and (p_installment_amount is null or p_total_installments is null or p_installment_frequency is null) then
    raise exception 'installmentAmount, totalInstallments, and installmentFrequency are required for installment obligations.'
      using errcode = 'P0001';
  end if;

  v_total_with_interest := case when p_interest_rate is not null and p_interest_type is not null
    then public.compute_total_with_interest(p_principal_amount, p_interest_rate, p_interest_type, p_start_date, p_due_date)
    else null end;

  insert into public.obligations (
    owner_id, direction, name, counterparty, counterparty_contact, principal_amount,
    remaining_balance, currency, interest_rate, interest_type, total_with_interest,
    start_date, due_date, wallet_id, category_id, notes, tags, status,
    is_installment, installment_amount, total_installments, paid_installments, installment_frequency
  ) values (
    auth.uid(), p_direction, p_name, p_counterparty, p_counterparty_contact, p_principal_amount,
    coalesce(v_total_with_interest, p_principal_amount), coalesce(p_currency, 'PHP'),
    p_interest_rate, p_interest_type, v_total_with_interest,
    p_start_date, p_due_date, p_wallet_id, p_category_id, p_notes, coalesce(p_tags, '{}'), 'active',
    coalesce(p_is_installment, false), p_installment_amount, p_total_installments, 0, p_installment_frequency
  )
  returning * into v_obligation;

  if p_wallet_id is not null then
    update public.wallets
    set balance = balance + case when p_direction = 'debt' then p_principal_amount else -p_principal_amount end
    where id = p_wallet_id and owner_id = auth.uid()
    returning * into v_wallet;

    if not found then
      raise exception 'Wallet not found.' using errcode = 'P0002';
    end if;

    if v_wallet.balance < 0 and p_direction <> 'debt' then
      raise exception 'Insufficient wallet balance to lend this amount.' using errcode = 'P0001';
    end if;

    insert into public.transactions (
      owner_id, wallet_id, category_id, amount, type, description, date, attachments, tags, status
    ) values (
      auth.uid(), p_wallet_id, p_category_id, p_principal_amount,
      case when p_direction = 'debt' then 'income' else 'expense' end,
      format('%s %s: %s', case when p_direction = 'debt' then 'Borrowed from' else 'Lent to' end, p_counterparty, p_name),
      p_start_date, '{}', coalesce(p_tags, '{}'), 'completed'
    )
    returning * into v_disbursement_tx;

    update public.obligations set disbursement_transaction_id = v_disbursement_tx.id where id = v_obligation.id;
  end if;

  if p_is_installment and p_installment_frequency is not null and p_installment_amount is not null and p_total_installments is not null then
    v_due_dates := public.build_installment_dates(p_start_date, p_installment_frequency, p_total_installments);

    foreach v_due_date in array v_due_dates loop
      insert into public.bills (
        owner_id, name, amount, category_id, due_date, is_recurring, type,
        wallet_id, reminder, reminder_days, payment_status, status, obligation_id
      ) values (
        auth.uid(), p_name || ' — Installment', p_installment_amount, p_category_id, v_due_date, false,
        case when p_direction = 'debt' then 'bill' else 'income' end,
        p_wallet_id, true, 3, 'unpaid', 'active', v_obligation.id
      )
      returning * into v_bill;

      if p_wallet_id is not null then
        insert into public.transactions (
          owner_id, wallet_id, category_id, amount, type, description, date,
          attachments, tags, bill_id, status
        ) values (
          auth.uid(), p_wallet_id, p_category_id, p_installment_amount,
          case when p_direction = 'debt' then 'expense' else 'income' end,
          p_name || ' — Installment', v_due_date, '{}', coalesce(p_tags, '{}'), v_bill.id, 'pending'
        )
        returning * into v_txn;

        update public.bills set transaction_id = v_txn.id where id = v_bill.id;
      end if;
    end loop;
  end if;

  select * into v_obligation from public.obligations where id = v_obligation.id;
  return v_obligation;
end;
$$;

grant execute on function public.obligations_create(
  obligation_direction, text, text, numeric, timestamptz, text, text, numeric, interest_type,
  timestamptz, uuid, uuid, text, text[], boolean, numeric, integer, installment_frequency
) to authenticated;

-- obligations_record_payment: mirrors obligations.service.ts#recordPayment
-- — idempotency guard, wallet balance update, payment transaction, remaining
-- balance/status update, and (for installments) marking the oldest unpaid
-- installment bill paid.
create or replace function public.obligations_record_payment(
  p_id uuid,
  p_amount numeric,
  p_wallet_id uuid,
  p_date timestamptz default null,
  p_notes text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_obligation public.obligations;
  v_wallet public.wallets;
  v_payment_date timestamptz;
  v_transaction_type transaction_type;
  v_balance_delta numeric;
  v_new_remaining numeric;
  v_new_status obligation_status;
  v_unpaid_bill public.bills;
begin
  if p_idempotency_key is not null and exists (
    select 1 from public.transactions
    where owner_id = auth.uid() and idempotency_key = p_idempotency_key
      and created_at >= now() - interval '24 hours' and status = 'completed'
  ) then
    return jsonb_build_object('id', p_id, 'message', 'Payment already recorded (cached).');
  end if;

  select * into v_obligation from public.obligations where id = p_id and owner_id = auth.uid();
  if not found then
    raise exception 'Obligation not found or you do not have permission.' using errcode = 'P0002';
  end if;

  if v_obligation.status in ('settled', 'archived') then
    raise exception 'Cannot record payment on a % obligation.', v_obligation.status using errcode = 'P0001';
  end if;

  v_transaction_type := case when v_obligation.direction = 'debt' then 'expense' else 'income' end;
  v_balance_delta := case when v_obligation.direction = 'debt' then -p_amount else p_amount end;

  update public.wallets set balance = balance + v_balance_delta
  where id = p_wallet_id and owner_id = auth.uid()
  returning * into v_wallet;

  if not found then
    raise exception 'Wallet not found.' using errcode = 'P0002';
  end if;

  if v_wallet.balance < 0 and v_obligation.direction = 'debt' then
    raise exception 'Insufficient wallet balance.' using errcode = 'P0001';
  end if;

  v_payment_date := coalesce(p_date, now());

  insert into public.transactions (
    owner_id, wallet_id, amount, type, description, date, attachments, tags, status, idempotency_key
  ) values (
    auth.uid(), p_wallet_id, p_amount, v_transaction_type,
    coalesce(p_notes, format('%s %s: %s',
      case when v_obligation.direction = 'debt' then 'Repayment to' else 'Received from' end,
      v_obligation.counterparty, v_obligation.name)),
    v_payment_date, '{}', '{}', 'completed', p_idempotency_key
  );

  v_new_remaining := round(greatest(0, v_obligation.remaining_balance - p_amount)::numeric, 2);
  v_new_status := case
    when v_new_remaining <= 0 then 'settled'
    when v_obligation.paid_installments > 0 or v_new_remaining < v_obligation.remaining_balance then 'partially_paid'
    else 'active'
  end;

  update public.obligations set remaining_balance = v_new_remaining, status = v_new_status where id = p_id;

  if v_obligation.is_installment then
    select * into v_unpaid_bill from public.bills
    where obligation_id = v_obligation.id and payment_status = 'unpaid' and status = 'active'
    order by due_date asc limit 1;

    if found then
      update public.bills
      set payment_status = case when p_amount >= v_unpaid_bill.amount then 'paid' else 'partial' end,
          paid_amount = p_amount, last_paid_date = v_payment_date
      where id = v_unpaid_bill.id;

      if v_unpaid_bill.transaction_id is not null then
        update public.transactions
        set status = 'completed', amount = p_amount, date = v_payment_date
        where id = v_unpaid_bill.transaction_id;
      end if;

      update public.obligations set paid_installments = paid_installments + 1 where id = v_obligation.id;
    end if;
  end if;

  return jsonb_build_object('remainingBalance', v_new_remaining, 'status', v_new_status);
end;
$$;

grant execute on function public.obligations_record_payment(uuid, numeric, uuid, timestamptz, text, text) to authenticated;

-- obligations_summary: mirrors obligations.service.ts#summary.
create or replace function public.obligations_summary()
returns jsonb
language plpgsql
stable
as $$
declare
  v_debt jsonb;
  v_lending jsonb;
begin
  select jsonb_build_object(
    'totalPrincipal', coalesce(sum(principal_amount), 0),
    'totalRemaining', coalesce(sum(remaining_balance), 0),
    'count', count(*),
    'activeCount', count(*) filter (where status in ('active', 'partially_paid'))
  ) into v_debt
  from public.obligations where owner_id = auth.uid() and direction = 'debt' and status <> 'archived';

  select jsonb_build_object(
    'totalPrincipal', coalesce(sum(principal_amount), 0),
    'totalRemaining', coalesce(sum(remaining_balance), 0),
    'count', count(*),
    'activeCount', count(*) filter (where status in ('active', 'partially_paid'))
  ) into v_lending
  from public.obligations where owner_id = auth.uid() and direction = 'lending' and status <> 'archived';

  return jsonb_build_object(
    'debt', v_debt, 'lending', v_lending,
    'netPosition', round(((v_lending->>'totalRemaining')::numeric - (v_debt->>'totalRemaining')::numeric)::numeric, 2)
  );
end;
$$;

grant execute on function public.obligations_summary() to authenticated;
