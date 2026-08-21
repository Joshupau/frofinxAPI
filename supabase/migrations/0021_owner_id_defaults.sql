-- Bug found via live smoke test: direct-insert tables (currently only
-- `wallets`, via fico/queries/user/wallet/wallets.ts#createWallet) didn't
-- set owner_id in the payload, so it defaulted to NULL and the RLS
-- WITH CHECK (owner_id = auth.uid()) correctly rejected the insert.
-- DEFAULT auth.uid() fixes this at the schema level for every current and
-- future direct-insert code path, rather than relying on every call site
-- remembering to set it explicitly.
alter table public.wallets alter column owner_id set default auth.uid();
alter table public.categories alter column owner_id set default auth.uid();
