# Database migrations

SQL migrations live in `supabase/migrations/`, numbered sequentially
(`0001_…`, `0002_…`). Each file is the source of truth for one schema change.

> **Why this doc exists:** migrations in this repo are **not applied
> automatically** — there is no CI step and no linked Supabase project. They
> have to be run against each environment by hand. A couple of migrations (e.g.
> `0012_app_settings`) were never applied to production, which surfaced later as
> `column … not found` and `permission denied` errors in the admin UI. This
> runbook is the process to prevent that recurring.

## Conventions

- **Numbering:** zero-padded, monotonic. The next migration after `0013` is
  `0014`. Never renumber or edit a migration that has already been applied to
  any shared environment — add a new one instead.
- **Idempotency:** write migrations so they are safe to run more than once
  (`create table if not exists`, `add column if not exists`,
  `drop policy if exists … create policy …`, re-`grant`). This makes recovery
  from partial application painless.
- **Grants + RLS go together.** Postgres checks table-level `GRANT`s *before*
  Row Level Security. A table with RLS policies but no grant to the role that
  queries it will fail with `permission denied` before any policy runs. When a
  table is added, grant the roles that touch it **and** add its RLS policies in
  the same migration:
  - `anon` — public/customer-facing reads only (if any).
  - `authenticated` — the admin UI (via the publishable-key client in
    `src/lib/supabase/server.ts` → `createClient()`). Needs whatever
    SELECT/INSERT/UPDATE/DELETE the admin pages perform.
  - `service_role` — server-side jobs and the Stripe webhook (via
    `createAdminClient()`). Bypasses RLS; still needs explicit grants.
- **Schema cache:** after DDL that changes columns or privileges, end the
  migration with `notify pgrst, 'reload schema';` so PostgREST (the REST API
  Supabase exposes) sees the change immediately instead of on its next periodic
  reload.

## Applying migrations to an environment

### Option A — Supabase SQL editor (what we do today)

1. Open the target project → **SQL Editor**.
2. Paste the contents of each **not-yet-applied** migration, in order.
3. Run it. Because migrations are idempotent, re-running an already-applied one
   is harmless.

### Option B — Supabase CLI (recommended going forward)

The `supabase` CLI is already a dev dependency.

```bash
# one-time: link the local repo to the remote project
npx supabase link --project-ref <project-ref>

# review what would change, then push all pending migrations
npx supabase db push
```

`db push` tracks which migrations have run, so it only applies new ones — this
is the durable fix for the "did 0012 ever run?" problem.

## Verifying an environment (drift audit)

After applying — or any time you suspect drift — run the read-only audit to
confirm tables, RLS, enums, the stock view, and grants all match expectations.
The audit is pure `SELECT`s against the catalog and changes nothing. See
`supabase/audit/schema_drift_audit.sql`.

Anything reported as `MISSING` / `RLS OFF`, or an `authenticated` grant column
lacking the privileges the admin UI needs, means a migration has not been fully
applied to that environment.

## When you hit `permission denied` or `column … not found` in the app

These almost always mean a migration did not reach that environment, not a code
bug. Steps:

1. Run the drift audit against that environment.
2. Identify the migration that introduces the missing object/grant.
3. Apply it (Option A or B above).
4. Re-run the audit to confirm the gap is closed.
