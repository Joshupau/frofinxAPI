-- Report RPCs. These replace transactions.service.ts's MongoDB aggregation
-- pipelines with plain SQL — date_trunc/extract stand in for Mongo's
-- $dayOfMonth/$dayOfWeek/$month/$hour group keys.

-- reports_monthly: mirrors getMonthlyReport.
create or replace function public.reports_monthly(
  p_month integer default null,
  p_year integer default null,
  p_wallet_id uuid default null
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_month integer := coalesce(p_month, extract(month from now())::integer);
  v_year integer := coalesce(p_year, extract(year from now())::integer);
  v_start timestamptz := make_timestamptz(v_year, v_month, 1, 0, 0, 0);
  v_end timestamptz := (v_start + interval '1 month') - interval '1 second';
  v_income numeric := 0; v_income_count integer := 0;
  v_expense numeric := 0; v_expense_count integer := 0;
  v_transfer numeric := 0; v_transfer_count integer := 0;
begin
  select
    coalesce(sum(amount) filter (where type = 'income'), 0),
    count(*) filter (where type = 'income'),
    coalesce(sum(amount) filter (where type = 'expense'), 0),
    count(*) filter (where type = 'expense'),
    coalesce(sum(amount) filter (where type = 'transfer'), 0),
    count(*) filter (where type = 'transfer')
  into v_income, v_income_count, v_expense, v_expense_count, v_transfer, v_transfer_count
  from public.transactions
  where owner_id = auth.uid() and status = 'completed'
    and date >= v_start and date <= v_end
    and (p_wallet_id is null or wallet_id = p_wallet_id);

  return jsonb_build_object(
    'month', v_month, 'year', v_year,
    'income', v_income, 'incomeCount', v_income_count,
    'expense', v_expense, 'expenseCount', v_expense_count,
    'transfers', v_transfer, 'transferCount', v_transfer_count,
    'netCashFlow', v_income - v_expense
  );
end;
$$;

grant execute on function public.reports_monthly(integer, integer, uuid) to authenticated;

-- reports_category_breakdown: mirrors getCategoryBreakdown. `p_period`
-- accepts 'today'|'week'|'month'|'year'|'all' as a shortcut, otherwise
-- p_start/p_end are used directly.
create or replace function public.reports_category_breakdown(
  p_type transaction_type,
  p_period text default null,
  p_start timestamptz default null,
  p_end timestamptz default null,
  p_wallet_id uuid default null
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_start timestamptz;
  v_end timestamptz := now();
  v_breakdown jsonb;
  v_total numeric;
  v_transaction_count integer;
begin
  if p_period = 'today' then v_start := date_trunc('day', now());
  elsif p_period = 'week' then v_start := date_trunc('week', now());
  elsif p_period = 'month' then v_start := date_trunc('month', now());
  elsif p_period = 'year' then v_start := date_trunc('year', now());
  elsif p_period = 'all' then v_start := make_timestamptz(2000, 1, 1, 0, 0, 0);
  else v_start := p_start; v_end := coalesce(p_end, now());
  end if;

  with breakdown as (
    select t.category_id, c.name, c.icon, c.color,
           sum(t.amount) as total, count(*) as cnt
    from public.transactions t
    left join public.categories c on c.id = t.category_id
    where t.owner_id = auth.uid() and t.type = p_type and t.status = 'completed'
      and (v_start is null or t.date >= v_start) and t.date <= v_end
      and (p_wallet_id is null or t.wallet_id = p_wallet_id)
    group by t.category_id, c.name, c.icon, c.color
  )
  select coalesce(sum(total), 0), coalesce(sum(cnt), 0) into v_total, v_transaction_count from breakdown;

  with breakdown as (
    select t.category_id, c.name, c.icon, c.color,
           sum(t.amount) as total, count(*) as cnt
    from public.transactions t
    left join public.categories c on c.id = t.category_id
    where t.owner_id = auth.uid() and t.type = p_type and t.status = 'completed'
      and (v_start is null or t.date >= v_start) and t.date <= v_end
      and (p_wallet_id is null or t.wallet_id = p_wallet_id)
    group by t.category_id, c.name, c.icon, c.color
    order by sum(t.amount) desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'categoryId', category_id, 'categoryName', coalesce(name, 'Uncategorized'),
    'categoryIcon', icon, 'categoryColor', color, 'total', total, 'count', cnt,
    'percentage', case when v_total > 0 then round((total / v_total) * 100, 2) else 0 end
  )), '[]'::jsonb)
  into v_breakdown
  from breakdown;

  return jsonb_build_object(
    'breakdown', v_breakdown, 'totalAmount', v_total,
    'transactionCount', v_transaction_count
  );
end;
$$;

grant execute on function public.reports_category_breakdown(transaction_type, text, timestamptz, timestamptz, uuid) to authenticated;

-- reports_dashboard_summary: mirrors getDashboardSummary — the original
-- Mongo aggregation's date range was commented out, so (faithfully) this
-- does NOT filter by month/year despite accepting them as parameters; they
-- only pass through into the response.
create or replace function public.reports_dashboard_summary(
  p_month integer default null,
  p_year integer default null,
  p_wallet_id uuid default null
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_month integer := coalesce(p_month, extract(month from now())::integer);
  v_year integer := coalesce(p_year, extract(year from now())::integer);
  v_income numeric := 0; v_income_count integer := 0;
  v_expense numeric := 0; v_expense_count integer := 0;
  v_transfer numeric := 0; v_transfer_count integer := 0;
begin
  if v_month < 1 or v_month > 12 then
    raise exception 'Invalid month. Please provide a month between 1 and 12.' using errcode = 'P0001';
  end if;

  select
    coalesce(sum(amount) filter (where type = 'income'), 0),
    count(*) filter (where type = 'income'),
    coalesce(sum(amount) filter (where type = 'expense'), 0),
    count(*) filter (where type = 'expense'),
    coalesce(sum(amount) filter (where type = 'transfer'), 0),
    count(*) filter (where type = 'transfer')
  into v_income, v_income_count, v_expense, v_expense_count, v_transfer, v_transfer_count
  from public.transactions
  where owner_id = auth.uid() and status = 'completed'
    and (p_wallet_id is null or wallet_id = p_wallet_id);

  return jsonb_build_object(
    'totalIncome', round(v_income, 2), 'incomeCount', v_income_count,
    'totalExpenses', round(v_expense, 2), 'expenseCount', v_expense_count,
    'totalTransfers', round(v_transfer, 2), 'transferCount', v_transfer_count,
    'totalTransactions', v_income_count + v_expense_count + v_transfer_count,
    'netCashFlow', round(v_income - v_expense, 2),
    'month', v_month, 'year', v_year
  );
end;
$$;

grant execute on function public.reports_dashboard_summary(integer, integer, uuid) to authenticated;

-- reports_quick_stats: mirrors getQuickStats ($facet -> plain aggregates in
-- one query, no separate round-trips needed).
create or replace function public.reports_quick_stats(
  p_period text default 'month',
  p_wallet_id uuid default null
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_start timestamptz;
  v_end timestamptz := now();
  v_income numeric := 0; v_expense numeric := 0; v_transfer numeric := 0; v_count integer := 0;
begin
  if p_period = 'today' then v_start := date_trunc('day', now());
  elsif p_period = 'week' then v_start := date_trunc('week', now());
  elsif p_period = 'year' then v_start := date_trunc('year', now());
  elsif p_period = 'all' then v_start := make_timestamptz(2000, 1, 1, 0, 0, 0);
  else v_start := date_trunc('month', now());
  end if;

  select
    coalesce(sum(amount) filter (where type = 'income'), 0),
    coalesce(sum(amount) filter (where type = 'expense'), 0),
    coalesce(sum(amount) filter (where type = 'transfer'), 0),
    count(*)
  into v_income, v_expense, v_transfer, v_count
  from public.transactions
  where owner_id = auth.uid() and status = 'completed'
    and date >= v_start and date <= v_end
    and (p_wallet_id is null or wallet_id = p_wallet_id);

  return jsonb_build_object(
    'period', p_period, 'income', round(v_income, 2), 'expenses', round(v_expense, 2),
    'transfers', round(v_transfer, 2), 'transactions', v_count,
    'startDate', v_start, 'endDate', v_end
  );
end;
$$;

grant execute on function public.reports_quick_stats(text, uuid) to authenticated;

-- reports_analytics: mirrors getAnalytics — dynamic bucketing by day
-- (last 30 days), week (last 52 weeks), or year (last 5 years). Transfers
-- are excluded, matching the original's `type: {$in:['income','expense']}`.
create or replace function public.reports_analytics(
  p_period text,
  p_wallet_id uuid default null
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_start timestamptz;
  v_data jsonb;
begin
  if p_period = 'daily' then v_start := now() - interval '30 days';
  elsif p_period = 'weekly' then v_start := now() - interval '364 days';
  else v_start := now() - interval '5 years';
  end if;

  if p_period = 'daily' then
    with buckets as (
      select date_trunc('day', date) as bucket,
             sum(amount) filter (where type = 'income') as income,
             sum(amount) filter (where type = 'expense') as expenses,
             count(*) as cnt
      from public.transactions
      where owner_id = auth.uid() and status = 'completed' and type in ('income', 'expense')
        and date >= v_start and date <= now()
        and (p_wallet_id is null or wallet_id = p_wallet_id)
      group by 1
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'date', to_char(bucket, 'YYYY-MM-DD'),
      'income', round(coalesce(income, 0), 2), 'expenses', round(coalesce(expenses, 0), 2),
      'net', round(coalesce(income, 0) - coalesce(expenses, 0), 2), 'transactionCount', cnt
    ) order by bucket desc), '[]'::jsonb) into v_data from buckets;
  elsif p_period = 'weekly' then
    with buckets as (
      select date_trunc('week', date) as bucket,
             extract(week from date) as wk, extract(month from date) as mo, extract(year from date) as yr,
             sum(amount) filter (where type = 'income') as income,
             sum(amount) filter (where type = 'expense') as expenses,
             count(*) as cnt
      from public.transactions
      where owner_id = auth.uid() and status = 'completed' and type in ('income', 'expense')
        and date >= v_start and date <= now()
        and (p_wallet_id is null or wallet_id = p_wallet_id)
      group by 1, 3, 4
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'week', wk, 'month', mo, 'year', yr,
      'income', round(coalesce(income, 0), 2), 'expenses', round(coalesce(expenses, 0), 2),
      'net', round(coalesce(income, 0) - coalesce(expenses, 0), 2), 'transactionCount', cnt
    ) order by bucket desc), '[]'::jsonb) into v_data from buckets;
  else
    with buckets as (
      select extract(year from date) as yr,
             sum(amount) filter (where type = 'income') as income,
             sum(amount) filter (where type = 'expense') as expenses,
             count(*) as cnt
      from public.transactions
      where owner_id = auth.uid() and status = 'completed' and type in ('income', 'expense')
        and date >= v_start and date <= now()
        and (p_wallet_id is null or wallet_id = p_wallet_id)
      group by 1
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'year', yr, 'income', round(coalesce(income, 0), 2), 'expenses', round(coalesce(expenses, 0), 2),
      'net', round(coalesce(income, 0) - coalesce(expenses, 0), 2), 'transactionCount', cnt
    ) order by yr desc), '[]'::jsonb) into v_data from buckets;
  end if;

  return jsonb_build_object(
    'period', p_period, 'walletId', p_wallet_id, 'data', v_data,
    'summary', jsonb_build_object(
      'totalIncome', (select coalesce(sum((x->>'income')::numeric), 0) from jsonb_array_elements(v_data) x),
      'totalExpenses', (select coalesce(sum((x->>'expenses')::numeric), 0) from jsonb_array_elements(v_data) x),
      'totalNet', (select coalesce(sum((x->>'net')::numeric), 0) from jsonb_array_elements(v_data) x),
      'transactionCount', (select coalesce(sum((x->>'transactionCount')::integer), 0) from jsonb_array_elements(v_data) x)
    )
  );
end;
$$;

grant execute on function public.reports_analytics(text, uuid) to authenticated;

-- reports_chart_data: mirrors getChartData — same bucketing idea as
-- reports_analytics but includes transfers and fills zero-value buckets for
-- every period in range (hour-of-day / day-of-week / day-of-month / month),
-- via generate_series, matching the original's app-level zero-fill loop.
create or replace function public.reports_chart_data(
  p_period text default 'month',
  p_wallet_id uuid default null
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_start timestamptz;
  v_end timestamptz := now();
  v_points jsonb;
  v_total_income numeric := 0; v_total_expenses numeric := 0; v_total_transfers numeric := 0;
begin
  if p_period = 'today' then
    v_start := date_trunc('day', now());
    with series as (select generate_series(0, 23) as slot),
    agg as (
      select extract(hour from date)::int as slot,
             sum(amount) filter (where type='income') as income,
             sum(amount) filter (where type='expense') as expenses,
             sum(amount) filter (where type='transfer') as transfers
      from public.transactions
      where owner_id = auth.uid() and status = 'completed'
        and date >= v_start and date < v_start + interval '1 day'
        and (p_wallet_id is null or wallet_id = p_wallet_id)
      group by 1
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'hour', s.slot, 'income', round(coalesce(a.income,0),2),
      'expenses', round(coalesce(a.expenses,0),2), 'transfers', round(coalesce(a.transfers,0),2)
    ) order by s.slot), '[]'::jsonb) into v_points
    from series s left join agg a on a.slot = s.slot;

  elsif p_period = 'week' then
    v_start := date_trunc('week', now());
    with series as (select generate_series(0, 6) as slot),
    agg as (
      select extract(dow from date)::int as slot,
             sum(amount) filter (where type='income') as income,
             sum(amount) filter (where type='expense') as expenses,
             sum(amount) filter (where type='transfer') as transfers
      from public.transactions
      where owner_id = auth.uid() and status = 'completed'
        and date >= v_start and date < v_start + interval '7 days'
        and (p_wallet_id is null or wallet_id = p_wallet_id)
      group by 1
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'day', to_char(v_start + make_interval(days => s.slot), 'FMDay'),
      'income', round(coalesce(a.income,0),2), 'expenses', round(coalesce(a.expenses,0),2),
      'transfers', round(coalesce(a.transfers,0),2)
    ) order by s.slot), '[]'::jsonb) into v_points
    from series s left join agg a on a.slot = s.slot;

  elsif p_period = 'year' then
    v_start := date_trunc('year', now());
    with series as (select generate_series(1, 12) as slot),
    agg as (
      select extract(month from date)::int as slot,
             sum(amount) filter (where type='income') as income,
             sum(amount) filter (where type='expense') as expenses,
             sum(amount) filter (where type='transfer') as transfers
      from public.transactions
      where owner_id = auth.uid() and status = 'completed'
        and date >= v_start and date < v_start + interval '1 year'
        and (p_wallet_id is null or wallet_id = p_wallet_id)
      group by 1
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'month', to_char(make_date(2000, s.slot, 1), 'FMMonth'),
      'income', round(coalesce(a.income,0),2), 'expenses', round(coalesce(a.expenses,0),2),
      'transfers', round(coalesce(a.transfers,0),2)
    ) order by s.slot), '[]'::jsonb) into v_points
    from series s left join agg a on a.slot = s.slot;

  elsif p_period = 'all' then
    with agg as (
      select extract(year from date)::int as yr,
             sum(amount) filter (where type='income') as income,
             sum(amount) filter (where type='expense') as expenses,
             sum(amount) filter (where type='transfer') as transfers
      from public.transactions
      where owner_id = auth.uid() and status = 'completed'
        and (p_wallet_id is null or wallet_id = p_wallet_id)
      group by 1
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'year', yr, 'income', round(coalesce(income,0),2), 'expenses', round(coalesce(expenses,0),2),
      'transfers', round(coalesce(transfers,0),2)
    ) order by yr), '[]'::jsonb) into v_points
    from agg;
    select min(make_timestamptz((x->>'year')::int, 1, 1, 0, 0, 0))
    into v_start
    from jsonb_array_elements(v_points) x;
    v_start := coalesce(v_start, now());

  else -- month (default)
    v_start := date_trunc('month', now());
    with series as (
      select generate_series(1, extract(day from (date_trunc('month', now()) + interval '1 month - 1 day'))::int) as slot
    ),
    agg as (
      select extract(day from date)::int as slot,
             sum(amount) filter (where type='income') as income,
             sum(amount) filter (where type='expense') as expenses,
             sum(amount) filter (where type='transfer') as transfers
      from public.transactions
      where owner_id = auth.uid() and status = 'completed'
        and date >= v_start and date < v_start + interval '1 month'
        and (p_wallet_id is null or wallet_id = p_wallet_id)
      group by 1
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'date', to_char(v_start, 'Mon') || '.' || s.slot,
      'income', round(coalesce(a.income,0),2), 'expenses', round(coalesce(a.expenses,0),2),
      'transfers', round(coalesce(a.transfers,0),2)
    ) order by s.slot), '[]'::jsonb) into v_points
    from series s left join agg a on a.slot = s.slot;
  end if;

  select coalesce(sum((x->>'income')::numeric), 0), coalesce(sum((x->>'expenses')::numeric), 0),
         coalesce(sum((x->>'transfers')::numeric), 0)
  into v_total_income, v_total_expenses, v_total_transfers
  from jsonb_array_elements(v_points) x;

  return jsonb_build_object(
    'period', p_period, 'startDate', v_start, 'endDate', v_end, 'dataPoints', v_points,
    'totals', jsonb_build_object(
      'income', round(v_total_income,2), 'expenses', round(v_total_expenses,2), 'transfers', round(v_total_transfers,2)
    )
  );
end;
$$;

grant execute on function public.reports_chart_data(text, uuid) to authenticated;

-- reports_top_category_today: mirrors getTopCategoryToday's SQL half only —
-- the Groq AI call and finance_agent_cache WRITE happen in the
-- finance-insight Edge Function, which calls this RPC first. If a cache row
-- already exists for today it's returned directly (needsInsight=false); if
-- there's no spending or no categorized spending, a canned insight is
-- returned directly too (no AI call needed, matching the original's early
-- returns); otherwise raw top-category data is returned for the Edge
-- Function to feed to Groq.
create or replace function public.reports_top_category_today(p_wallet_id uuid default null)
returns jsonb
language plpgsql
as $$
declare
  v_today timestamptz := date_trunc('day', now());
  v_total_spent_today numeric;
  v_top record;
  v_cached public.finance_agent_cache;
begin
  select coalesce(sum(amount), 0) into v_total_spent_today
  from public.transactions
  where owner_id = auth.uid() and type = 'expense' and status = 'completed'
    and date >= v_today and date < v_today + interval '1 day'
    and (p_wallet_id is null or wallet_id = p_wallet_id);

  if v_total_spent_today = 0 then
    return jsonb_build_object(
      'needsInsight', false,
      'categoryId', '', 'categoryName', 'No expenses', 'totalSpent', 0, 'transactionCount', 0,
      'percentageOfDay', 0,
      'insight', '💚 Great job! You haven''t spent anything today – financial discipline unlocked!'
    );
  end if;

  select t.category_id, c.name as category_name, c.icon as category_icon, c.color as category_color,
         sum(t.amount) as total_spent, count(*) as cnt,
         array_agg(t.description) as descriptions
  into v_top
  from public.transactions t
  left join public.categories c on c.id = t.category_id
  where t.owner_id = auth.uid() and t.type = 'expense' and t.status = 'completed'
    and t.date >= v_today and t.date < v_today + interval '1 day'
    and (p_wallet_id is null or t.wallet_id = p_wallet_id)
  group by t.category_id, c.name, c.icon, c.color
  order by sum(t.amount) desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'needsInsight', false,
      'categoryId', '', 'categoryName', 'Uncategorized', 'totalSpent', v_total_spent_today, 'transactionCount', 0,
      'percentageOfDay', 100,
      'insight', format('📋 All your spending today is uncategorized. %s spent with no label!', v_total_spent_today)
    );
  end if;

  select * into v_cached from public.finance_agent_cache
  where owner_id = auth.uid()
    and category_key = coalesce(v_top.category_id::text, '')
    and created_at >= v_today and created_at < v_today + interval '1 day'
  limit 1;

  if found then
    return jsonb_build_object(
      'needsInsight', false,
      'categoryId', coalesce(v_top.category_id::text, ''), 'categoryName', coalesce(v_top.category_name, 'Uncategorized'),
      'categoryIcon', v_top.category_icon, 'categoryColor', v_top.category_color,
      'totalSpent', round(v_top.total_spent, 2), 'transactionCount', v_top.cnt,
      'percentageOfDay', round((v_top.total_spent / v_total_spent_today) * 100, 1),
      'insight', v_cached.description
    );
  end if;

  return jsonb_build_object(
    'needsInsight', true,
    'categoryId', coalesce(v_top.category_id::text, ''), 'categoryName', coalesce(v_top.category_name, 'Uncategorized'),
    'categoryIcon', v_top.category_icon, 'categoryColor', v_top.category_color,
    'walletId', p_wallet_id,
    'totalSpent', round(v_top.total_spent, 2), 'transactionCount', v_top.cnt,
    'percentageOfDay', round((v_top.total_spent / v_total_spent_today) * 100, 1),
    'descriptions', to_jsonb(v_top.descriptions)
  );
end;
$$;

grant execute on function public.reports_top_category_today(uuid) to authenticated;
