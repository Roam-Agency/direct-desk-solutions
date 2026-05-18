-- ============================================================================
-- Migration 0007: Condition reports
-- One report per product. Each report has many itemised observations,
-- optionally linked to a specific product image.
-- ============================================================================

-- 1. Enums --------------------------------------------------------------------

create type condition_severity as enum ('faultless', 'light', 'moderate', 'significant');

-- 2. condition_reports --------------------------------------------------------

create table condition_reports (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null unique references products(id) on delete cascade,
  summary      text,
  grade        product_grade,  -- nullable; report may exist before grading finalised
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz
);

create index idx_condition_reports_product_id on condition_reports(product_id);

create trigger condition_reports_updated_at
  before update on condition_reports
  for each row execute function set_updated_at();

-- 3. condition_report_items ---------------------------------------------------

create table condition_report_items (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references condition_reports(id) on delete cascade,
  severity    condition_severity not null,
  area        text not null,           -- "right armrest", "lumbar pad", "mechanism"
  description text not null,
  image_id    uuid references product_images(id) on delete set null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_condition_report_items_report_id on condition_report_items(report_id);
create index idx_condition_report_items_image_id on condition_report_items(image_id);

create trigger condition_report_items_updated_at
  before update on condition_report_items
  for each row execute function set_updated_at();

-- 4. Row Level Security -------------------------------------------------------

alter table condition_reports enable row level security;
alter table condition_report_items enable row level security;

-- Public can read reports whose product is live. RLS on products already
-- restricts non-live products to authenticated; this mirrors that.
create policy "public can read reports for live products"
  on condition_reports for select
  using (
    exists (
      select 1 from products p
      where p.id = condition_reports.product_id
        and p.status = 'live'
    )
  );

create policy "public can read items for live-product reports"
  on condition_report_items for select
  using (
    exists (
      select 1
      from condition_reports r
      join products p on p.id = r.product_id
      where r.id = condition_report_items.report_id
        and p.status = 'live'
    )
  );

-- Authenticated users (admins) can do anything. Tightened later with role.
create policy "authenticated users can manage condition_reports"
  on condition_reports for all
  to authenticated
  using (true) with check (true);

create policy "authenticated users can manage condition_report_items"
  on condition_report_items for all
  to authenticated
  using (true) with check (true);

-- 5. Grants -------------------------------------------------------------------

grant select on condition_reports to anon, authenticated;
grant insert, update, delete on condition_reports to authenticated;
grant select, insert, update, delete on condition_reports to service_role;

grant select on condition_report_items to anon, authenticated;
grant insert, update, delete on condition_report_items to authenticated;
grant select, insert, update, delete on condition_report_items to service_role;
