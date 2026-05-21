-- ============================================================================
-- Migration 0008: Customers, orders, order items, stock reservations
--
-- This migration introduces the e-commerce data backbone for Stripe checkout.
--
-- Tables:
--   customers           One row per unique buyer email (lowercased).
--                       Order-derived: created/updated on every completed
--                       checkout session. Email is the natural key. We do
--                       NOT use Stripe Customer objects yet (Session 11+ work
--                       if needed for saved cards). Designed so we can layer
--                       stripe_customer_id on later without migration pain.
--
--   orders              One row per completed Stripe Checkout session.
--                       Order shipping/billing snapshots are stored on the
--                       order itself (not on customer) so historical orders
--                       remain accurate if a customer updates their address.
--
--   order_items         Line items per order. Snapshots product name,
--                       price, condition, grade so the order remains
--                       readable even if the product is later edited or
--                       deleted.
--
--   stock_reservations  Short-lived holds on product stock during the
--                       Stripe Checkout window (15 minutes). Reservation is
--                       converted to a permanent stock decrement when the
--                       Stripe session completes, or expires silently if
--                       the buyer abandons. A cron job (later) can sweep
--                       stale reservations; for v1 we just check the
--                       expires_at column when computing available stock.
--
-- RLS model: customers/orders/order_items/stock_reservations are admin-only.
-- No public read or write policies. The Stripe webhook writes via the
-- admin (service-role) client, which bypasses RLS.
-- ============================================================================

-- 1. Enums --------------------------------------------------------------------

create type order_status as enum (
  'pending',     -- Checkout session created, payment not yet confirmed
  'paid',        -- checkout.session.completed received; stock decremented
  'fulfilled',   -- Admin marked as shipped/delivered
  'cancelled',   -- Cancelled before payment OR refunded after payment
  'refunded'     -- Fully or partially refunded (see refunded_pence)
);

create type reservation_status as enum (
  'active',      -- Hold is live, blocks stock from other buyers
  'confirmed',   -- Payment completed, hold converted to permanent stock decrement
  'expired',     -- TTL elapsed without payment, stock released
  'cancelled'    -- Explicitly released (buyer abandoned, webhook signal, etc.)
);

-- 2. customers ----------------------------------------------------------------
-- Email-keyed customer record, derived from completed Stripe sessions.
-- email is lowercased and trimmed on insert/update by the webhook.

create table customers (
  id                       uuid primary key default gen_random_uuid(),
  email                    text not null unique,
  first_name               text,
  last_name                text,
  phone                    text,         -- E.164 from Stripe (e.g. +447700900000)

  -- Marketing consent (UK GDPR: affirmative opt-in required for marketing
  -- emails). Captured at checkout via Stripe's consent_collection. We store
  -- the timestamp as audit evidence; admins can override via the admin UI.
  marketing_consent        boolean not null default false,
  marketing_consent_at     timestamptz,

  -- Aggregate stats. Maintained by the webhook on every paid order so the
  -- admin list view doesn't need an N+1 join. Recompute on refund/cancel.
  total_orders             integer not null default 0,
  total_spent_pence        bigint not null default 0,
  first_order_at           timestamptz,
  last_order_at            timestamptz,

  -- Audit timestamps. updated_at maintained by trigger below.
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index idx_customers_email on customers(email);
create index idx_customers_last_order_at on customers(last_order_at desc nulls last);
create index idx_customers_marketing_consent on customers(marketing_consent) where marketing_consent = true;

create trigger customers_updated_at
  before update on customers
  for each row execute function set_updated_at();

-- 3. orders -------------------------------------------------------------------
-- One row per completed Stripe Checkout session. Address snapshots are
-- stored as JSONB so admins see exactly what was shipped where, even if
-- the customer later updates their default address.

create table orders (
  id                       uuid primary key default gen_random_uuid(),
  customer_id              uuid not null references customers(id) on delete restrict,

  -- Stripe identifiers. session_id is the cs_test_... or cs_live_... value
  -- used as the idempotency anchor in the webhook (we look up by this to
  -- detect duplicate webhook deliveries).
  stripe_session_id        text not null unique,
  stripe_payment_intent    text,        -- pi_... populated when payment confirms

  status                   order_status not null default 'pending',

  -- Money fields, all in integer pence per codebase convention.
  -- subtotal_pence      = sum of line item totals BEFORE shipping
  -- shipping_pence      = shipping cost charged
  -- total_pence         = subtotal + shipping (what the customer paid)
  -- refunded_pence      = portion refunded (0 unless status = refunded)
  subtotal_pence           bigint not null,
  shipping_pence           bigint not null default 0,
  total_pence              bigint not null,
  refunded_pence           bigint not null default 0,

  -- Snapshots of shipping/billing details from the Stripe session.
  -- JSONB so we can capture whatever Stripe returns without schema churn.
  -- Expected shape (best-effort, may vary by Stripe version):
  --   { name, line1, line2, city, postal_code, country, state? }
  shipping_address         jsonb,
  billing_address          jsonb,

  -- Stripe consent.promotions value, copied here for per-order audit.
  -- The customer-level marketing_consent reflects their CURRENT state
  -- (latest order wins); this preserves the per-order signal.
  marketing_consent_order  boolean not null default false,

  notes                    text,        -- Admin-only freeform note
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  paid_at                  timestamptz, -- Set when status flips to 'paid'
  fulfilled_at             timestamptz  -- Set when admin marks fulfilled
);

create index idx_orders_customer_id on orders(customer_id);
create index idx_orders_status on orders(status);
create index idx_orders_created_at on orders(created_at desc);
create index idx_orders_stripe_session_id on orders(stripe_session_id);

create trigger orders_updated_at
  before update on orders
  for each row execute function set_updated_at();

-- 4. order_items --------------------------------------------------------------
-- Line items per order. We snapshot the product fields that matter at the
-- time of purchase so the order detail page reads correctly forever, even
-- if the product is later edited, archived, or deleted. product_id is
-- preserved as a soft link (on delete set null) for analytics.

create table order_items (
  id                       uuid primary key default gen_random_uuid(),
  order_id                 uuid not null references orders(id) on delete cascade,
  product_id               uuid references products(id) on delete set null,

  -- Snapshots taken at order creation (webhook time).
  product_name             text not null,
  product_sku              text not null,
  product_brand            text,
  product_condition        product_condition not null,
  product_grade            product_grade,
  product_slug             text not null,
  product_hero_url         text,

  unit_price_pence         bigint not null,    -- Price at time of order
  quantity                 integer not null check (quantity > 0),
  line_total_pence         bigint not null,    -- unit_price_pence * quantity

  created_at               timestamptz not null default now()
);

create index idx_order_items_order_id on order_items(order_id);
create index idx_order_items_product_id on order_items(product_id);

-- 5. stock_reservations -------------------------------------------------------
-- 15-minute holds created when a buyer starts a Stripe Checkout session.
-- The available stock for a product is:
--   products.stock_quantity - SUM(active reservations for that product)
--
-- When the Stripe session completes, the reservation flips to 'confirmed'
-- and an explicit stock_quantity decrement is applied to the product row.
-- If TTL passes without completion, the reservation flips to 'expired' on
-- the next read (lazy expiry) and stops counting against available stock.

create table stock_reservations (
  id                       uuid primary key default gen_random_uuid(),
  product_id               uuid not null references products(id) on delete cascade,
  stripe_session_id        text not null,
  quantity                 integer not null check (quantity > 0),
  status                   reservation_status not null default 'active',
  expires_at               timestamptz not null,
  created_at               timestamptz not null default now(),
  confirmed_at             timestamptz,
  cancelled_at             timestamptz
);

create index idx_stock_reservations_product_id_active
  on stock_reservations(product_id)
  where status = 'active';
create index idx_stock_reservations_session_id on stock_reservations(stripe_session_id);
create index idx_stock_reservations_expires_at on stock_reservations(expires_at)
  where status = 'active';

-- 6. Row Level Security -------------------------------------------------------
-- All four tables are admin-only. No public read, no public insert.
-- The Stripe webhook uses the admin (service-role) client which bypasses
-- RLS entirely. Admin pages read via the publishable-key client + RLS
-- policy that lets authenticated users see everything.

alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table stock_reservations enable row level security;

-- Authenticated users (admins) can read + manage all four tables.
-- Tightened later by role if/when we add non-admin authenticated users.

create policy "authenticated users can manage customers"
  on customers for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated users can manage orders"
  on orders for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated users can manage order_items"
  on order_items for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated users can manage stock_reservations"
  on stock_reservations for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- No public policies. anon role gets nothing on these tables.
-- The service-role key (used by the webhook) bypasses RLS by design.

-- 7. Helper view: available_stock --------------------------------------------
-- Convenience view used by the cart drift-check + the createCheckoutSession
-- action so they reason about "stock minus active reservations" without
-- repeating the calculation. expires_at is checked lazily here.

create view product_available_stock as
select
  p.id as product_id,
  p.stock_quantity,
  p.stock_quantity - coalesce(
    (select sum(r.quantity)
     from stock_reservations r
     where r.product_id = p.id
       and r.status = 'active'
       and r.expires_at > now()), 0
  )::integer as available_stock
from products p;

comment on view product_available_stock is
  'Real-time available stock = product.stock_quantity minus active, unexpired reservations. Use this in cart refresh and createCheckoutSession.';
