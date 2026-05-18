-- ============================================================================
-- Migration 0005: Categories + product_categories
-- Hierarchical, many-to-many taxonomy supporting three browse patterns:
-- functional (Desks, Seating...), brand (Herman Miller...), merchandising
-- (Clearance, New Arrivals...).
-- ============================================================================

-- 1. Enums --------------------------------------------------------------------

create type category_kind as enum ('functional', 'brand', 'merchandising');

-- 2. Categories table ---------------------------------------------------------

create table categories (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references categories(id) on delete restrict,
  name        text not null,
  slug        text unique not null,
  description text,
  kind        category_kind not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Slug must be URL-safe (same regex as products.slug)
  constraint categories_slug_format check (slug ~ '^[a-z0-9-]+$'),
  -- A category can't be its own parent
  constraint categories_no_self_parent check (id <> parent_id)
);

-- 3. Indexes ------------------------------------------------------------------

create index idx_categories_parent_id on categories(parent_id);
create index idx_categories_kind on categories(kind);
create index idx_categories_is_active on categories(is_active);
create index idx_categories_sort on categories(kind, sort_order);

-- 4. Auto-update updated_at ---------------------------------------------------
-- Reuses set_updated_at() trigger function defined in migration 0001.

create trigger categories_updated_at
  before update on categories
  for each row execute function set_updated_at();

-- 5. Product-Categories join table -------------------------------------------

create table product_categories (
  product_id   uuid not null references products(id) on delete cascade,
  category_id  uuid not null references categories(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (product_id, category_id)
);

create index idx_product_categories_category on product_categories(category_id);

-- 6. Row Level Security: categories ------------------------------------------

alter table categories enable row level security;

create policy "public can read active categories"
  on categories for select
  using (is_active = true);

create policy "authenticated users can manage categories"
  on categories for all
  to authenticated
  using (true)
  with check (true);

-- 7. Row Level Security: product_categories ----------------------------------

alter table product_categories enable row level security;

-- Public can read join rows. Product visibility is enforced by the products
-- table's own RLS — joining doesn't expose draft products.
create policy "public can read product_categories"
  on product_categories for select
  using (true);

create policy "authenticated users can manage product_categories"
  on product_categories for all
  to authenticated
  using (true)
  with check (true);

-- 8. Grants -------------------------------------------------------------------
-- "Auto-expose new tables" is OFF on this Supabase project, so every role
-- needs explicit grants. service_role is required for admin-client work.

grant select on categories to anon, authenticated;
grant insert, update, delete on categories to authenticated;
grant select, insert, update, delete on categories to service_role;

grant select on product_categories to anon, authenticated;
grant insert, update, delete on product_categories to authenticated;
grant select, insert, update, delete on product_categories to service_role;

-- 9. Seed data ----------------------------------------------------------------
-- Eleven starter categories across all three kinds. Admin can extend, archive,
-- or reorder via the /admin/categories UI.

insert into categories (name, slug, description, kind, sort_order) values
  -- Functional (the main customer browse axis)
  ('Desks',           'desks',           'Sit-stand, fixed-height and bench desks for home and office.', 'functional', 10),
  ('Seating',         'seating',         'Task chairs, executive chairs, meeting and lounge seating.',   'functional', 20),
  ('Storage',         'storage',         'Pedestals, tambour cabinets, lockers and bookcases.',          'functional', 30),
  ('Meeting Tables',  'meeting-tables',  'Boardroom, conference and breakout tables.',                   'functional', 40),
  ('Reception',       'reception',       'Reception desks, lounge seating and signage furniture.',       'functional', 50),
  ('Acoustic Booths', 'acoustic-booths', 'Focus pods, phone booths and meeting capsules.',               'functional', 60),

  -- Brand (the used catalogue differentiator)
  ('Herman Miller',   'herman-miller',   'Aeron, Embody, Sayl and other Herman Miller classics.',        'brand',      10),
  ('Steelcase',       'steelcase',       'Leap, Think, Gesture and other Steelcase seating.',            'brand',      20),
  ('Vitra',           'vitra',           'ID Chair, Eames, AC5 and the wider Vitra catalogue.',          'brand',      30),

  -- Merchandising (homepage rails, time-bound)
  ('New Arrivals',    'new-arrivals',    'Recently added to the catalogue.',                             'merchandising', 10),
  ('Used Bestsellers','used-bestsellers','Most-loved pieces from the pre-owned range.',                  'merchandising', 20);

-- 10. Backfill: existing brand text → brand categories -----------------------
-- Auto-assign existing products to their matching brand category by name.
-- Products whose brand text doesn't match a seeded brand category are left
-- unassigned (admin can fix in the UI).

insert into product_categories (product_id, category_id)
select p.id, c.id
from products p
join categories c
  on c.kind = 'brand'
  and lower(c.name) = lower(p.brand)
where p.brand is not null;
