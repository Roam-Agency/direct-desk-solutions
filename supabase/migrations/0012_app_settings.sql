-- ============================================================================
-- Migration 0012: app_settings — site-wide admin settings singleton
--
-- A single-row table (id = 1) holding store-wide configuration the admin can
-- edit from /admin/settings:
--   - free_shipping_active   master switch for site-wide free delivery
--                            (flash sales) — read by the checkout flow
--   - free_delivery_message  promotional copy shown to customers
--   - low_stock_threshold    default low-stock threshold for products with no
--                            per-product alert set (drives the dashboard count)
--   - contact_email          public-facing contact address
--   - default_warranty_terms reserved for future use; kept for forward-compat
--
-- Idempotent: the generated TypeScript types already reference this table, so
-- it may exist in some environments. `if not exists` guards make this safe to
-- run regardless.
-- ============================================================================

-- 1. Table --------------------------------------------------------------------

create table if not exists app_settings (
  id                    integer primary key default 1,
  free_shipping_active  boolean not null default false,
  free_delivery_message text not null default 'Free UK delivery on orders over £500',
  low_stock_threshold   integer not null default 3,
  contact_email         text not null default 'info@directdesksolutions.com',
  default_warranty_terms text not null default '',
  updated_at            timestamptz not null default now(),
  updated_by            uuid,

  -- Enforce the singleton: only one row, always id = 1.
  constraint app_settings_singleton check (id = 1)
);

-- Column may be missing if the table pre-dates this migration.
alter table app_settings
  add column if not exists free_shipping_active boolean not null default false;

-- 2. Auto-update updated_at ---------------------------------------------------
-- Reuses set_updated_at() trigger function defined in migration 0001.

drop trigger if exists app_settings_updated_at on app_settings;
create trigger app_settings_updated_at
  before update on app_settings
  for each row execute function set_updated_at();

-- 3. Row Level Security -------------------------------------------------------

alter table app_settings enable row level security;

-- Public read: the checkout flow (anonymous buyers) needs free_shipping_active,
-- and customer-facing chrome reads contact_email + free_delivery_message.
-- Nothing here is sensitive.
drop policy if exists "public can read app_settings" on app_settings;
create policy "public can read app_settings"
  on app_settings for select
  using (true);

drop policy if exists "authenticated users can manage app_settings" on app_settings;
create policy "authenticated users can manage app_settings"
  on app_settings for all
  to authenticated
  using (true)
  with check (true);

-- 4. Grants -------------------------------------------------------------------
-- "Auto-expose new tables" is OFF on this Supabase project, so every role
-- needs explicit grants.

grant select on app_settings to anon, authenticated;
grant insert, update, delete on app_settings to authenticated;
grant select, insert, update, delete on app_settings to service_role;

-- 5. Seed the singleton row ---------------------------------------------------
-- Defaults match the previously hardcoded values so behaviour is unchanged
-- until an admin edits them.

insert into app_settings (id) values (1)
  on conflict (id) do nothing;
