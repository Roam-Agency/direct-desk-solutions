-- ============================================================================
-- Migration 0001: Products table
-- Creates the core products table supporting both new and used items.
-- ============================================================================

-- 1. Enums --------------------------------------------------------------------

create type product_condition as enum ('new', 'used');
create type product_grade as enum ('A', 'B', 'C');
create type product_status as enum ('draft', 'live', 'archived');

-- 2. Products table -----------------------------------------------------------

create table products (
  -- Identity
  id              uuid primary key default gen_random_uuid(),
  sku             text unique not null,
  slug            text unique not null,
  name            text not null,
  description     text,
  brand           text,

  -- Pricing (stored in pence — integer maths, no floating-point bugs)
  price_pence       integer not null check (price_pence >= 0),
  was_price_pence   integer check (was_price_pence >= 0),
  cost_price_pence  integer check (cost_price_pence >= 0),

  -- Inventory
  stock_quantity      integer not null default 0 check (stock_quantity >= 0),
  low_stock_alert     integer default 5,
  warehouse_location  text,

  -- Condition (the new/used differentiator)
  condition         product_condition not null,
  condition_grade   product_grade,
  condition_notes   text,
  source            text,
  refurb_date       date,

  -- Logistics
  weight_kg         numeric(6,2),
  dimensions        jsonb,  -- {width_cm, depth_cm, height_cm}

  -- Specifications & search
  specifications    jsonb default '{}'::jsonb,
  tags              text[] default '{}'::text[],

  -- Status & timestamps
  status            product_status not null default 'draft',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  published_at      timestamptz,

  -- Constraints
  constraint used_must_have_grade
    check (
      (condition = 'new' and condition_grade is null)
      or
      (condition = 'used' and condition_grade is not null)
    )
);

-- 3. Indexes ------------------------------------------------------------------

create index idx_products_status on products(status);
create index idx_products_condition on products(condition);
create index idx_products_brand on products(brand);
create index idx_products_published_at on products(published_at desc);

-- Full-text search across name + description
create index idx_products_fts on products
  using gin(to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,'')));

-- 4. Auto-update updated_at ---------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger products_updated_at
  before update on products
  for each row execute function set_updated_at();

-- 5. Row Level Security -------------------------------------------------------

alter table products enable row level security;

-- Public can read live products (the customer-facing shop)
create policy "public can read live products"
  on products for select
  using (status = 'live');

-- Authenticated users can do anything (tightened later with admin role check)
create policy "authenticated users can manage products"
  on products for all
  to authenticated
  using (true)
  with check (true);

-- 6. Sample data --------------------------------------------------------------

insert into products (
  sku, slug, name, description, brand,
  price_pence, was_price_pence, cost_price_pence,
  stock_quantity, warehouse_location,
  condition, condition_grade, condition_notes, source, refurb_date,
  weight_kg, dimensions, specifications, tags,
  status, published_at
) values
-- New items
('DDS-NEW-DSK-001', 'sit-stand-desk-140cm-oak',
 'Sit-Stand Desk 140cm', 'Electric height-adjustable desk with oak top and steel frame. 140cm wide.',
 'DDS House', 49900, 59900, 22000,
 12, 'A1-03', 'new', null, null, null, null,
 38.5, '{"width_cm": 140, "depth_cm": 70, "height_cm": 120}'::jsonb,
 '{"motor": "dual", "memory_presets": 4, "max_load_kg": 80, "colour": "oak"}'::jsonb,
 array['desk', 'sit-stand', 'electric', 'home-office'],
 'live', now()),

('DDS-NEW-CHR-001', 'mesh-task-chair-pro',
 'Mesh Task Chair Pro', 'Ergonomic mesh chair with adjustable lumbar, 4D armrests, synchro-tilt.',
 'DDS House', 28900, null, 11500,
 30, 'B2-08', 'new', null, null, null, null,
 18.2, '{"width_cm": 65, "depth_cm": 65, "height_cm": 120}'::jsonb,
 '{"mesh_back": true, "armrests": "4D", "tilt": "synchro", "max_load_kg": 130, "warranty_years": 5}'::jsonb,
 array['chair', 'task-chair', 'mesh', 'ergonomic'],
 'live', now()),

-- Used items
('DDS-USED-AER-014', 'herman-miller-aeron-size-b-graphite',
 'Herman Miller Aeron Size B', 'Graphite frame, 8Z Pellicle mesh, fully loaded. Light wear on armrests only.',
 'Herman Miller', 64500, 145000, 18000,
 1, 'C4-12', 'used', 'B',
 'Light scuffing on right armrest; light wear on lumbar pad. Mechanism faultless. Stains: none.',
 'Corporate clear-out, EC2 (legal firm relocation)', '2026-04-22',
 21.0, '{"width_cm": 68, "depth_cm": 68, "height_cm": 120}'::jsonb,
 '{"size": "B", "frame": "graphite", "mesh": "8Z Pellicle", "tilt": "fully adjustable", "armrests": "fully adjustable", "lumbar": "PostureFit SL"}'::jsonb,
 array['chair', 'aeron', 'herman-miller', 'pre-owned', 'premium'],
 'live', now()),

('DDS-USED-STL-007', 'steelcase-think-v2-black-mesh',
 'Steelcase Think v2', 'Black frame, black mesh, height-adjustable arms. Grade A — barely used.',
 'Steelcase', 42500, 89000, 12000,
 3, 'C4-18', 'used', 'A',
 'Excellent condition. Original packaging. From cancelled office fit-out — never installed.',
 'Cancelled fit-out, Manchester', '2026-05-02',
 19.5, '{"width_cm": 65, "depth_cm": 65, "height_cm": 110}'::jsonb,
 '{"frame": "black", "mesh": "black", "arms": "height-adjustable", "tilt": "weight-activated"}'::jsonb,
 array['chair', 'steelcase', 'think', 'pre-owned'],
 'live', now()),

-- Draft (should NOT be visible to public)
('DDS-USED-VIT-003', 'vitra-id-mesh-anthracite',
 'Vitra ID Mesh', 'Anthracite mesh task chair. Awaiting condition photos before publishing.',
 'Vitra', 32500, 75000, 9500,
 2, 'C4-22', 'used', 'B',
 'Pending inspection. Listed for tracking.',
 'Office downsizing, Bristol', '2026-05-10',
 17.0, '{"width_cm": 64, "depth_cm": 64, "height_cm": 108}'::jsonb,
 '{}'::jsonb,
 array['chair', 'vitra', 'pre-owned'],
 'draft', null);

-- 7. Grants -------------------------------------------------------------------
-- Allow the API roles to access the products table.
-- (RLS policies still apply — these grants just permit the API to try.)

grant select on products to anon, authenticated;
grant insert, update, delete on products to authenticated;
