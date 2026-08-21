-- wallets_adjust_balance: mirrors wallets.service.ts#adjustBalance — no
-- negative-balance guard in the original, intentionally not added here.
create or replace function public.wallets_adjust_balance(
  p_wallet_id uuid,
  p_amount numeric
)
returns public.wallets
language plpgsql
as $$
declare
  v_wallet public.wallets;
begin
  update public.wallets
  set balance = balance + p_amount
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

grant execute on function public.wallets_adjust_balance(uuid, numeric) to authenticated;

-- categories_create: mirrors categories.service.ts#create — rejects a
-- duplicate active name+type pair for the same owner (case-insensitive).
create or replace function public.categories_create(
  p_name text,
  p_type category_type,
  p_icon text default null,
  p_color text default null
)
returns public.categories
language plpgsql
as $$
declare
  v_category public.categories;
begin
  if exists (
    select 1 from public.categories
    where owner_id = auth.uid()
      and type = p_type
      and status = 'active'
      and lower(name) = lower(p_name)
  ) then
    raise exception 'Category with this name already exists.' using errcode = 'P0001';
  end if;

  insert into public.categories (owner_id, name, type, icon, color, is_default, status)
  values (auth.uid(), p_name, p_type, p_icon, p_color, false, 'active')
  returning * into v_category;

  return v_category;
end;
$$;

grant execute on function public.categories_create(text, category_type, text, text) to authenticated;
