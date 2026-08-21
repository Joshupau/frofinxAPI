-- investments_create: mirrors investments.service.ts#create — inserts the
-- investment with an initial value snapshot, and (if funded from a wallet)
-- a linked funding transaction + wallet debit, atomically.
create or replace function public.investments_create(
  p_name text,
  p_type investment_type,
  p_principal_amount numeric,
  p_start_date timestamptz,
  p_currency text default 'PHP',
  p_platform text default null,
  p_wallet_id uuid default null,
  p_category_id uuid default null,
  p_maturity_date timestamptz default null,
  p_expected_return_rate numeric default null,
  p_notes text default null,
  p_tags text[] default '{}'
)
returns public.investments
language plpgsql
as $$
declare
  v_investment public.investments;
  v_wallet public.wallets;
  v_funding_tx public.transactions;
begin
  insert into public.investments (
    owner_id, name, type, principal_amount, current_value, currency, platform,
    wallet_id, category_id, start_date, maturity_date, expected_return_rate,
    dividends_received, notes, tags, status
  ) values (
    auth.uid(), p_name, p_type, p_principal_amount, p_principal_amount, coalesce(p_currency, 'PHP'), p_platform,
    p_wallet_id, p_category_id, p_start_date, p_maturity_date, p_expected_return_rate,
    0, p_notes, coalesce(p_tags, '{}'), 'active'
  )
  returning * into v_investment;

  insert into public.investment_value_snapshots (investment_id, value, snapshot_date)
  values (v_investment.id, p_principal_amount, p_start_date);

  if p_wallet_id is not null then
    update public.wallets set balance = balance - p_principal_amount
    where id = p_wallet_id and owner_id = auth.uid()
    returning * into v_wallet;

    if not found then
      raise exception 'Wallet not found.' using errcode = 'P0002';
    end if;

    if v_wallet.balance < 0 then
      raise exception 'Insufficient wallet balance to fund this investment.' using errcode = 'P0001';
    end if;

    insert into public.transactions (
      owner_id, wallet_id, category_id, amount, type, description, date, attachments, tags, status
    ) values (
      auth.uid(), p_wallet_id, p_category_id, p_principal_amount, 'expense',
      format('Investment: %s (%s)', p_name, p_type), p_start_date, '{}', coalesce(p_tags, '{}'), 'completed'
    )
    returning * into v_funding_tx;

    update public.investments set funding_transaction_id = v_funding_tx.id where id = v_investment.id;
  end if;

  select * into v_investment from public.investments where id = v_investment.id;
  return v_investment;
end;
$$;

grant execute on function public.investments_create(
  text, investment_type, numeric, timestamptz, text, text, uuid, uuid, timestamptz, numeric, text, text[]
) to authenticated;

-- investments_update_value: mirrors investments.service.ts#updateValue.
create or replace function public.investments_update_value(
  p_id uuid,
  p_value numeric,
  p_date timestamptz default null,
  p_notes text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_snapshot_date timestamptz := coalesce(p_date, now());
begin
  update public.investments set current_value = p_value
  where id = p_id and owner_id = auth.uid();

  if not found then
    raise exception 'Investment not found or you do not have permission.' using errcode = 'P0002';
  end if;

  insert into public.investment_value_snapshots (investment_id, value, snapshot_date, notes)
  values (p_id, p_value, v_snapshot_date, p_notes);

  return jsonb_build_object('currentValue', p_value, 'snapshot', jsonb_build_object(
    'value', p_value, 'date', v_snapshot_date, 'notes', p_notes
  ));
end;
$$;

grant execute on function public.investments_update_value(uuid, numeric, timestamptz, text) to authenticated;

-- investments_record_return: mirrors investments.service.ts#recordReturn.
create or replace function public.investments_record_return(
  p_id uuid,
  p_amount numeric,
  p_wallet_id uuid,
  p_date timestamptz default null,
  p_notes text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_investment public.investments;
  v_return_date timestamptz := coalesce(p_date, now());
  v_new_dividends numeric;
begin
  select * into v_investment from public.investments where id = p_id and owner_id = auth.uid();
  if not found then
    raise exception 'Investment not found or you do not have permission.' using errcode = 'P0002';
  end if;

  update public.wallets set balance = balance + p_amount
  where id = p_wallet_id and owner_id = auth.uid();

  insert into public.transactions (
    owner_id, wallet_id, category_id, amount, type, description, date, attachments, tags, status
  ) values (
    auth.uid(), p_wallet_id, v_investment.category_id, p_amount, 'income',
    coalesce(p_notes, format('Investment return: %s', v_investment.name)),
    v_return_date, '{}', v_investment.tags, 'completed'
  );

  update public.investments set dividends_received = dividends_received + p_amount
  where id = p_id
  returning dividends_received into v_new_dividends;

  return jsonb_build_object('amount', p_amount, 'dividendsReceived', v_new_dividends);
end;
$$;

grant execute on function public.investments_record_return(uuid, numeric, uuid, timestamptz, text) to authenticated;

-- investments_sell: mirrors investments.service.ts#sell.
create or replace function public.investments_sell(
  p_id uuid,
  p_sale_amount numeric,
  p_wallet_id uuid,
  p_date timestamptz default null,
  p_notes text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_investment public.investments;
  v_sale_date timestamptz := coalesce(p_date, now());
  v_gain_loss numeric;
begin
  select * into v_investment from public.investments where id = p_id and owner_id = auth.uid();
  if not found then
    raise exception 'Investment not found or you do not have permission.' using errcode = 'P0002';
  end if;

  if v_investment.status in ('sold', 'archived') then
    raise exception 'Cannot sell a % investment.', v_investment.status using errcode = 'P0001';
  end if;

  v_gain_loss := round((p_sale_amount - v_investment.principal_amount)::numeric, 2);

  update public.wallets set balance = balance + p_sale_amount
  where id = p_wallet_id and owner_id = auth.uid();

  insert into public.transactions (
    owner_id, wallet_id, category_id, amount, type, description, date, attachments, tags, status
  ) values (
    auth.uid(), p_wallet_id, v_investment.category_id, p_sale_amount, 'income',
    coalesce(p_notes, format('Sale of investment: %s', v_investment.name)),
    v_sale_date, '{}', v_investment.tags, 'completed'
  );

  update public.investments set status = 'sold', current_value = p_sale_amount where id = p_id;

  insert into public.investment_value_snapshots (investment_id, value, snapshot_date, notes)
  values (p_id, p_sale_amount, v_sale_date, coalesce(p_notes, 'Sold'));

  return jsonb_build_object('saleAmount', p_sale_amount, 'gainLoss', v_gain_loss);
end;
$$;

grant execute on function public.investments_sell(uuid, numeric, uuid, timestamptz, text) to authenticated;

-- investments_summary: mirrors investments.service.ts#summary.
create or replace function public.investments_summary()
returns jsonb
language plpgsql
stable
as $$
declare
  v_total_invested numeric;
  v_total_current numeric;
  v_total_dividends numeric;
  v_count integer;
  v_active_count integer;
  v_total_gain_loss numeric;
  v_return_rate numeric;
  v_by_type jsonb;
begin
  select
    coalesce(sum(principal_amount), 0), coalesce(sum(current_value), 0), coalesce(sum(dividends_received), 0),
    count(*), count(*) filter (where status = 'active')
  into v_total_invested, v_total_current, v_total_dividends, v_count, v_active_count
  from public.investments where owner_id = auth.uid() and status <> 'archived';

  v_total_gain_loss := round((v_total_current - v_total_invested + v_total_dividends)::numeric, 2);
  v_return_rate := case when v_total_invested > 0 then round((v_total_gain_loss / v_total_invested) * 100, 2) else 0 end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'type', type, 'totalInvested', total_invested, 'totalCurrentValue', total_current,
    'count', cnt, 'gainLoss', round((total_current - total_invested)::numeric, 2)
  )), '[]'::jsonb)
  into v_by_type
  from (
    select type, sum(principal_amount) as total_invested, sum(current_value) as total_current, count(*) as cnt
    from public.investments where owner_id = auth.uid() and status <> 'archived'
    group by type
  ) t;

  return jsonb_build_object(
    'totalInvested', v_total_invested, 'totalCurrentValue', v_total_current, 'totalDividends', v_total_dividends,
    'totalGainLoss', v_total_gain_loss, 'returnRate', v_return_rate,
    'count', v_count, 'activeCount', v_active_count, 'byType', v_by_type
  );
end;
$$;

grant execute on function public.investments_summary() to authenticated;
