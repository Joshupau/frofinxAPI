-- Shared helper functions used by the domain RPCs in later migrations.
-- All RPCs in this project are SECURITY INVOKER (the default) unless noted
-- otherwise, so RLS policies from 0011 still apply to every read/write they
-- perform under the calling user's JWT.

-- Public, safe-to-expose maintenance-mode check. SECURITY DEFINER because
-- `maintenance` has RLS enabled with zero policies (Edge-Function-only) —
-- this function is the one sanctioned read path for anon/authenticated
-- callers, used before login is submitted.
create or replace function public.is_maintenance_mode()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select value = 'maintenance' from public.maintenance where type = 'full'),
    false
  );
$$;

grant execute on function public.is_maintenance_mode() to anon, authenticated;

-- Simple: P * (1 + r * t); Compound: P * (1 + r)^t.
-- t = years between start and due date (or 1 year if no due date given).
create or replace function public.compute_total_with_interest(
  p_principal numeric,
  p_rate numeric,
  p_type interest_type,
  p_start timestamptz,
  p_due timestamptz
)
returns numeric
language plpgsql
immutable
as $$
declare
  v_end timestamptz := coalesce(p_due, p_start + interval '365.25 days');
  v_years numeric := greatest(extract(epoch from (v_end - p_start)) / (365.25 * 24 * 3600), 0);
  v_r numeric := p_rate / 100;
begin
  if p_type = 'compound' then
    return round((p_principal * power(1 + v_r, v_years))::numeric, 2);
  end if;
  return round((p_principal * (1 + v_r * v_years))::numeric, 2);
end;
$$;

-- Next occurrence of a recurring bill / investment cadence.
create or replace function public.calculate_next_due_date(
  p_current timestamptz,
  p_frequency recurring_frequency
)
returns timestamptz
language sql
immutable
as $$
  select case p_frequency
    when 'daily' then p_current + interval '1 day'
    when 'weekly' then p_current + interval '7 days'
    when 'monthly' then p_current + interval '1 month'
    when 'yearly' then p_current + interval '1 year'
    else p_current
  end;
$$;

-- Installment due dates, offset forward from start_date, count entries.
create or replace function public.build_installment_dates(
  p_start timestamptz,
  p_frequency installment_frequency,
  p_count integer
)
returns timestamptz[]
language plpgsql
immutable
as $$
declare
  v_dates timestamptz[] := '{}';
  v_cursor timestamptz := p_start;
  i integer;
begin
  for i in 1..p_count loop
    v_cursor := case p_frequency
      when 'weekly' then v_cursor + interval '7 days'
      when 'monthly' then v_cursor + interval '1 month'
      when 'yearly' then v_cursor + interval '1 year'
    end;
    v_dates := array_append(v_dates, v_cursor);
  end loop;
  return v_dates;
end;
$$;
