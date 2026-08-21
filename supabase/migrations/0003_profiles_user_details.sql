-- profiles: app-specific fields Users had beyond what Supabase Auth itself
-- stores (auth.users already covers email/password/identities). Populated by
-- a trigger on auth.users insert, not by app code.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  status text not null default 'active',
  bandate text,
  banreason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Seeds a profile row from signUp({options:{data:{username}}}) metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Fast, RLS-bypassing lookup used by the auth-resolve-username Edge Function.
create or replace function public.profile_is_active()
returns boolean
language sql
stable
security invoker
as $$
  select coalesce(
    (select status = 'active' from public.profiles where id = auth.uid()),
    false
  );
$$;

create table public.user_details (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  phonenumber text,
  firstname text,
  lastname text,
  address text,
  city text,
  country text,
  postalcode text,
  paymentmethod text default '',
  accountnumber text default '',
  profilepicture text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_user_details_updated_at
  before update on public.user_details
  for each row execute function public.set_updated_at();
