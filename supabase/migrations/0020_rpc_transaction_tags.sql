-- transactions_all_tags: mirrors transactions.service.ts#getAllUserTags —
-- unnest(tags) stands in for Mongo's $unwind.
create or replace function public.transactions_all_tags()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_build_object(
    'tags', jsonb_agg(tag order by cnt desc),
    'tagStats', jsonb_agg(jsonb_build_object('tag', tag, 'count', cnt) order by cnt desc)
  ), jsonb_build_object('tags', '[]'::jsonb, 'tagStats', '[]'::jsonb))
  from (
    select tag, count(*) as cnt
    from public.transactions, unnest(tags) as tag
    where owner_id = auth.uid() and status = 'completed'
    group by tag
    order by cnt desc
  ) t;
$$;

grant execute on function public.transactions_all_tags() to authenticated;

-- transactions_spent_today: mirrors transactions.service.ts#getSpentToday.
create or replace function public.transactions_spent_today(p_wallet_id uuid default null)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'totalSpent', round(coalesce(sum(amount), 0), 2),
    'transactionCount', count(*),
    'date', to_char(date_trunc('day', now()), 'YYYY-MM-DD')
  )
  from public.transactions
  where owner_id = auth.uid() and type = 'expense' and status = 'completed'
    and date >= date_trunc('day', now()) and date < date_trunc('day', now()) + interval '1 day'
    and (p_wallet_id is null or wallet_id = p_wallet_id);
$$;

grant execute on function public.transactions_spent_today(uuid) to authenticated;
