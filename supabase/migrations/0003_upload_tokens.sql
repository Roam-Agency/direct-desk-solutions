-- 0003_upload_tokens.sql
-- One-time-ish tokens authorising mobile uploads to a specific product.
-- The token IS the credential: the /upload/[token] page is NOT behind admin auth,
-- because it's scanned by whatever phone the admin happens to be holding.
-- Service-role access only from server code. Anon and authenticated have NO direct access.

create extension if not exists "pgcrypto";

create table public.upload_tokens (
  token        uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '15 minutes'),
  used_count   integer not null default 0,
  revoked_at   timestamptz
);

create index upload_tokens_product_id_idx on public.upload_tokens (product_id);
create index upload_tokens_expires_at_idx on public.upload_tokens (expires_at);

-- RLS: deny everything to anon and authenticated. Server code uses the service-role
-- client, which bypasses RLS. The mobile uploader page resolves tokens via Server
-- Actions running with the service-role client.
alter table public.upload_tokens enable row level security;

-- Explicit deny policies (no grants = no access, but being explicit is clearer).
revoke all on public.upload_tokens from anon, authenticated;

-- Realtime: we want the desktop edit page to see new product_images rows when the
-- mobile session uploads. Add product_images to the supabase_realtime publication
-- (0002 created the table but didn't enable realtime broadcasting on it).
-- Use a DO block so re-running the migration is idempotent.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'product_images'
  ) then
    alter publication supabase_realtime add table public.product_images;
  end if;
end $$;

comment on table public.upload_tokens is
  'Short-lived tokens that authorise an unauthenticated mobile device to upload images for a specific product. 15-min TTL, multi-use within window.';

