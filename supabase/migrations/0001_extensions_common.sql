-- Extensions and shared helper objects used across every later migration.

create extension if not exists pgcrypto;

-- Generic updated_at maintenance trigger, attached to every table with an
-- updated_at column (mirrors Mongoose's `timestamps: true`).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
