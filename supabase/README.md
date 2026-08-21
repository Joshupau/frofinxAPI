# fico Supabase backend

This directory is the source of truth for the full-Supabase migration described in
`C:\Users\Joshu\.claude\plans\migrate-backend-to-supabase-jiggly-lerdorf.md`. It replaces the
Express/MongoDB backend in this repo (`app.ts`, `controllers/`, `cservice/`, `models/`,
`routes/`, `config/passport.ts`) once cutover completes.

## What's here

- `migrations/` — schema, RLS policies, and PL/pgSQL RPC functions (0001–0020), applied in
  filename order.
- `functions/` — Edge Functions (Deno): `auth-resolve-username`, `auth-globalpass-login`,
  `import-transactions`, `finance-insight`, `staff-login`, `staff-admin`.
- `scripts/migrate-from-mongo.ts` — one-time ETL from the live Mongo database into Postgres.

## Steps only you can run (need your Supabase account / credentials)

I don't have a Supabase account or the ability to create cloud resources, so the following are
manual steps before this becomes a working backend:

1. **Create a Supabase project** at supabase.com (or `supabase projects create` via the CLI if
   you're logged in). Note the project ref, `anon` key, and `service_role` key from
   Project Settings → API, and the pooled/direct Postgres connection strings from
   Project Settings → Database.

2. **Link this repo to the project**:
   ```
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```

3. **Apply the migrations**:
   ```
   npx supabase db push
   ```
   This runs every file in `migrations/` in order against your project's Postgres.

4. **Configure OAuth providers** (Google, Facebook) in the Dashboard under
   Authentication → Providers, reusing the existing `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/
   `FACEBOOK_APP_ID`/`FACEBOOK_APP_SECRET` values from `fico-api/.env`, with the redirect URI
   updated to `https://<project-ref>.supabase.co/auth/v1/callback`.

5. **Set Edge Function secrets**:
   ```
   npx supabase secrets set GROQ_API_KEY=<value> STAFF_JWT_SECRET=<a-long-random-string>
   ```
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically at runtime — do not
   set them yourself.

6. **Deploy the Edge Functions**:
   ```
   npx supabase functions deploy auth-resolve-username
   npx supabase functions deploy auth-globalpass-login
   npx supabase functions deploy import-transactions
   npx supabase functions deploy finance-insight
   npx supabase functions deploy staff-login
   npx supabase functions deploy staff-admin
   ```

7. **Create at least one staff (admin) account** — there's no self-serve registration for
   `staff_users` by design (see `staff-admin`'s `staff.register` action, which itself requires an
   existing `superadmin`). For the very first admin, insert directly via the SQL editor:
   ```sql
   -- bcrypt-hash a password first (e.g. via `node -e "console.log(require('bcryptjs').hashSync('yourpassword', 10))"`)
   insert into staff_users (username, password_hash, status, role)
   values ('admin', '<bcrypt-hash>', 'active', 'superadmin');
   ```

8. **Point the frontend at your project** — set in `fico/.env` (or your deployment's env vars):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   NEXT_PUBLIC_BACKEND=supabase   # flip from 'legacy' once you're ready to test
   ```

9. **Run the ETL** once the schema/functions above are live and you're ready to bring over real
   data:
   ```
   MONGO_URL=<your-mongo-connection-string> \
   SUPABASE_URL=https://<project-ref>.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
   npx tsx supabase/scripts/migrate-from-mongo.ts
   ```
   Every migrated user gets a random password and `needs_password_reset: true` in their
   `user_metadata` — wire a "reset your password" prompt into the login flow for accounts with
   that flag before pointing real users at the Supabase backend. Users with no email on file get
   a `<username>@migrated.fico.invalid` placeholder and `needs_email_update: true` — they'll need
   to add a real email (via an admin/support flow) before a password reset email can ever reach
   them.

## Verification (per the plan's Phase 1 checklist)

- Supabase Studio's SQL editor and its API docs tab (Table Editor → API) let you test RPCs and
  table access directly, e.g.:
  ```
  curl -X POST 'https://<project-ref>.supabase.co/rest/v1/rpc/reports_monthly' \
    -H "apikey: <anon-key>" -H "Authorization: Bearer <a-user-jwt>" \
    -H "Content-Type: application/json" -d '{}'
  ```
- There's no Postman-collection equivalent for RPCs/Edge Functions the way `fico-api/postman/`
  covered the old REST routes — the closest analog is scripting `curl` calls per function, or
  exercising them through the frontend once `NEXT_PUBLIC_BACKEND=supabase` is set in a preview
  deploy.
- Before decommissioning Mongo/`fico-api`, diff each report RPC's output against the old
  Mongo-aggregation results for the same historical data (`reports_monthly`,
  `reports_category_breakdown`, `reports_dashboard_summary`, `reports_quick_stats`,
  `reports_analytics`, `reports_chart_data`, `reports_top_category_today`).

## Known gaps / follow-ups not covered by this pass

- **Obligations/Investments frontend pages**: the query-hook layer
  (`fico/queries/user/obligation/obligations.ts`, `fico/queries/user/investment/investments.ts`)
  and types are complete and wired to both backends, but no `ionic-pages/`/`components/page/`
  UI was built for these two domains yet (there wasn't any before this migration either — see
  the plan's Context section). Build pages against the existing hooks, following the pattern in
  `components/page/*` for wallets/bills/budgets.
- **Staff/admin frontend**: `staff-login` and `staff-admin` Edge Functions exist, but there's no
  admin UI in `fico` calling them yet (the old Express app didn't have a corresponding `fico`
  admin UI either, based on the explored codebase — if one exists elsewhere, wire it to these
  functions instead of `fico-api`'s `/staffuser`/`/user` admin routes).
- **Password hash import**: verify whether Supabase's Admin API supports bulk bcrypt hash import
  in your project's GoTrue version before running the ETL against production — if it does,
  swapping `migrateUsers()`'s `admin.createUser()` call for the hash-import path avoids forcing
  every existing user through a password reset.
- **`budgets.service.ts`'s exact rollover semantics** were ported as read from the source file,
  but re-verify `budgets_rollover` against real data once migrated — it intentionally uses the
  budget's currently-stored `spent` value (not recomputed), matching the original.
