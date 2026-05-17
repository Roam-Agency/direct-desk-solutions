-- Migration: 0002_product_images
-- Creates the product_images table to store references to Cloudinary-hosted
-- product photos. We do not store the image binary in Postgres — Cloudinary
-- holds the files and serves them via CDN. We only persist the metadata
-- needed to reference, order, and display them.

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  cloudinary_public_id text not null,
  cloudinary_url text not null,
  alt_text text not null default '',
  is_hero boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Standard updated_at trigger, matching the products table pattern.
create trigger product_images_set_updated_at
  before update on public.product_images
  for each row
  execute function public.set_updated_at();

-- Dominant query: "all images for product X ordered by sort_order".
-- Composite index serves both filter and sort.
create index product_images_product_sort_idx
  on public.product_images (product_id, sort_order);

-- Hero lookups (list page thumbnail, customer product cards).
-- Partial index keeps it tiny.
create index product_images_hero_idx
  on public.product_images (product_id)
  where is_hero = true;

-- RLS: mirror the products table read/write split.
alter table public.product_images enable row level security;

create policy "public can read images of live products"
  on public.product_images
  for select
  to anon
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and p.status = 'live'
    )
  );

create policy "authenticated users can read all images"
  on public.product_images
  for select
  to authenticated
  using (true);

create policy "authenticated users can manage images"
  on public.product_images
  for all
  to authenticated
  using (true)
  with check (true);

-- Default of 'no auto-expose new tables' means we have to grant explicitly.
grant select on public.product_images to anon;
grant select, insert, update, delete on public.product_images to authenticated;

