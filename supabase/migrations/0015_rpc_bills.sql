-- bills_create: mirrors bills.service.ts#create — inserting a bill with a
-- wallet auto-creates a linked pending transaction representing the unpaid
-- bill, atomically.
create or replace function public.bills_create(
  p_name text,
  p_amount numeric,
  p_due_date timestamptz,
  p_is_recurring boolean,
  p_type bill_type,
  p_category_id uuid default null,
  p_recurring_frequency recurring_frequency default null,
  p_wallet_id uuid default null,
  p_reminder boolean default true,
  p_reminder_days integer default 3,
  p_notes text default null
)
returns public.bills
language plpgsql
as $$
declare
  v_bill public.bills;
  v_txn public.transactions;
begin
  if p_is_recurring and p_recurring_frequency is null then
    raise exception 'Recurring frequency required for recurring bills.' using errcode = 'P0001';
  end if;

  insert into public.bills (
    owner_id, name, amount, category_id, due_date, is_recurring, type,
    recurring_frequency, wallet_id, reminder, reminder_days, notes,
    payment_status, status
  ) values (
    auth.uid(), p_name, p_amount, p_category_id, p_due_date, p_is_recurring, p_type,
    p_recurring_frequency, p_wallet_id, p_reminder, p_reminder_days, p_notes,
    'unpaid', 'active'
  )
  returning * into v_bill;

  if p_wallet_id is not null then
    insert into public.transactions (
      owner_id, wallet_id, category_id, amount, type, description, date,
      attachments, tags, bill_id, status
    ) values (
      auth.uid(), p_wallet_id, p_category_id, p_amount, 'expense',
      format('Bill: %s', p_name), p_due_date, '{}', '{}', v_bill.id, 'pending'
    )
    returning * into v_txn;

    update public.bills set transaction_id = v_txn.id where id = v_bill.id
    returning * into v_bill;
  end if;

  return v_bill;
end;
$$;

grant execute on function public.bills_create(
  text, numeric, timestamptz, boolean, bill_type, uuid, recurring_frequency, uuid, boolean, integer, text
) to authenticated;

-- bills_mark_paid: mirrors bills.service.ts#markPaid — the single most
-- involved bill operation: idempotency guard, atomic wallet debit, linked
-- transaction completion, obligation back-update for installment bills, and
-- non-destructive recurrence (creates the NEXT bill rather than overwriting).
create or replace function public.bills_mark_paid(
  p_id uuid,
  p_paid_amount numeric default null,
  p_paid_date timestamptz default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_bill public.bills;
  v_amount_paid numeric;
  v_payment_date timestamptz;
  v_wallet public.wallets;
  v_payment_status bill_payment_status;
  v_obligation public.obligations;
  v_new_remaining numeric;
  v_new_paid_installments integer;
  v_new_obl_status obligation_status;
  v_next_due_date timestamptz;
  v_next_bill public.bills;
  v_next_txn public.transactions;
begin
  if p_idempotency_key is not null and exists (
    select 1 from public.transactions
    where owner_id = auth.uid()
      and idempotency_key = p_idempotency_key
      and created_at >= now() - interval '24 hours'
      and status = 'completed'
  ) then
    return jsonb_build_object(
      'id', p_id,
      'message', 'Duplicate payment request detected. Original payment processed.'
    );
  end if;

  select * into v_bill from public.bills where id = p_id and owner_id = auth.uid();
  if not found then
    raise exception 'Bill not found or you do not have permission.' using errcode = 'P0002';
  end if;

  v_amount_paid := coalesce(p_paid_amount, v_bill.amount);
  v_payment_date := coalesce(p_paid_date, now());

  if v_bill.wallet_id is not null then
    update public.wallets
    set balance = balance - v_amount_paid
    where id = v_bill.wallet_id and owner_id = auth.uid()
    returning * into v_wallet;

    if not found then
      raise exception 'Linked wallet not found or inactive.' using errcode = 'P0002';
    end if;

    if v_wallet.balance < 0 then
      raise exception 'Insufficient wallet balance to pay this bill.' using errcode = 'P0001';
    end if;
  end if;

  v_payment_status := case when v_amount_paid >= v_bill.amount then 'paid' else 'partial' end;

  if v_bill.transaction_id is not null then
    update public.transactions
    set status = 'completed', amount = v_amount_paid, date = v_payment_date,
        idempotency_key = coalesce(p_idempotency_key, idempotency_key)
    where id = v_bill.transaction_id;
  end if;

  if v_bill.obligation_id is not null then
    select * into v_obligation from public.obligations where id = v_bill.obligation_id;
    if found and v_obligation.status not in ('settled', 'archived') then
      v_new_remaining := round(greatest(0, v_obligation.remaining_balance - v_amount_paid)::numeric, 2);
      v_new_paid_installments := case when v_obligation.is_installment
        then v_obligation.paid_installments + 1 else v_obligation.paid_installments end;
      v_new_obl_status := case
        when v_new_remaining <= 0 then 'settled'
        when v_new_paid_installments > 0 then 'partially_paid'
        else 'active'
      end;

      update public.obligations
      set remaining_balance = v_new_remaining,
          paid_installments = v_new_paid_installments,
          status = v_new_obl_status
      where id = v_obligation.id;
    end if;
  end if;

  if v_bill.is_recurring and v_bill.recurring_frequency is not null then
    v_next_due_date := public.calculate_next_due_date(v_bill.due_date, v_bill.recurring_frequency);

    insert into public.bills (
      owner_id, name, amount, category_id, due_date, is_recurring, recurring_frequency,
      wallet_id, reminder, reminder_days, notes, payment_status, status, parent_bill_id, type
    ) values (
      v_bill.owner_id, v_bill.name, v_bill.amount, v_bill.category_id, v_next_due_date,
      v_bill.is_recurring, v_bill.recurring_frequency, v_bill.wallet_id, v_bill.reminder,
      v_bill.reminder_days, v_bill.notes, 'unpaid', 'active',
      coalesce(v_bill.parent_bill_id, v_bill.id), v_bill.type
    )
    returning * into v_next_bill;

    if v_bill.wallet_id is not null then
      insert into public.transactions (
        owner_id, wallet_id, category_id, amount, type, description, date,
        attachments, tags, bill_id, status
      ) values (
        v_bill.owner_id, v_bill.wallet_id, v_bill.category_id, v_bill.amount, 'expense',
        format('Bill: %s', v_bill.name), v_next_due_date, '{}', '{}', v_next_bill.id, 'pending'
      )
      returning * into v_next_txn;

      update public.bills set transaction_id = v_next_txn.id where id = v_next_bill.id;
    end if;
  end if;

  update public.bills
  set paid_amount = v_amount_paid, last_paid_date = v_payment_date, payment_status = v_payment_status
  where id = p_id;

  return jsonb_build_object(
    'billId', p_id,
    'amountPaid', v_amount_paid,
    'nextDueDate', v_next_due_date,
    'isRecurring', v_bill.is_recurring
  );
end;
$$;

grant execute on function public.bills_mark_paid(uuid, numeric, timestamptz, text) to authenticated;

-- bills_get_overdue: mirrors bills.service.ts#getOverdue — also flips
-- matching rows to payment_status='overdue' as a side effect, same as the
-- original.
create or replace function public.bills_get_overdue()
returns setof public.bills
language plpgsql
as $$
begin
  update public.bills
  set payment_status = 'overdue'
  where owner_id = auth.uid()
    and status = 'active'
    and payment_status in ('unpaid', 'partial')
    and due_date < date_trunc('day', now());

  return query
  select * from public.bills
  where owner_id = auth.uid()
    and status = 'active'
    and payment_status = 'overdue'
  order by due_date asc;
end;
$$;

grant execute on function public.bills_get_overdue() to authenticated;

-- bills_summary: mirrors bills.service.ts#getSummary's $facet aggregation
-- plus the wallet-balance-derived disposable income calculation.
create or replace function public.bills_summary()
returns jsonb
language plpgsql
stable
as $$
declare
  v_total_bills integer;
  v_paid_bills integer;
  v_unpaid_bills integer;
  v_overdue_bills integer;
  v_partial_bills integer;
  v_recurring_bills integer;
  v_total_amount_due numeric;
  v_upcoming_amount numeric;
  v_overdue_amount numeric;
  v_total_wallet_balance numeric;
begin
  select
    count(*),
    count(*) filter (where payment_status = 'paid'),
    count(*) filter (where payment_status = 'unpaid'),
    count(*) filter (where payment_status = 'overdue'),
    count(*) filter (where payment_status = 'partial'),
    count(*) filter (where is_recurring)
  into v_total_bills, v_paid_bills, v_unpaid_bills, v_overdue_bills, v_partial_bills, v_recurring_bills
  from public.bills
  where owner_id = auth.uid() and status = 'active';

  select
    coalesce(sum(amount), 0),
    coalesce(sum(amount) filter (where due_date > now()), 0),
    coalesce(sum(amount) filter (where due_date < now()), 0)
  into v_total_amount_due, v_upcoming_amount, v_overdue_amount
  from public.bills
  where owner_id = auth.uid() and status = 'active'
    and payment_status in ('unpaid', 'overdue', 'partial');

  select coalesce(sum(balance), 0) into v_total_wallet_balance
  from public.wallets where owner_id = auth.uid() and status = 'active';

  return jsonb_build_object(
    'totalBills', v_total_bills,
    'paidBills', v_paid_bills,
    'unpaidBills', v_unpaid_bills,
    'overdueBills', v_overdue_bills,
    'partialBills', v_partial_bills,
    'recurringBills', v_recurring_bills,
    'totalAmountDue', v_total_amount_due,
    'upcomingAmount', v_upcoming_amount,
    'overdueAmount', v_overdue_amount,
    'totalWalletBalance', v_total_wallet_balance,
    'disposableIncome', v_total_wallet_balance - v_total_amount_due,
    'summary', jsonb_build_object(
      'message', format('You have %s unpaid bills totaling ₱%s',
        v_unpaid_bills + v_overdue_bills, to_char(v_total_amount_due, 'FM999999990.00'))
    )
  );
end;
$$;

grant execute on function public.bills_summary() to authenticated;
