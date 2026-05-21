-- Migration 0010: grant SELECT on product_available_stock view.
--
-- The view was created in migration 0008 (orders_and_reservations.sql)
-- but no GRANTs were added. Postgres view permissions do NOT cascade
-- from underlying tables; they require explicit grants on the view.
--
-- This caused createCheckoutSession server action to fail with
--   ERROR 42501: permission denied for view product_available_stock
-- even when querying via service_role (which DOES bypass RLS, but
-- still needs explicit object-level grants on views).
--
-- Mirror the products table's grant pattern (migration 0001):
--   grant select on products to anon, authenticated;
-- The view returns the same data the underlying tables already
-- expose, so the security envelope is unchanged - we are not
-- widening anything.

grant select on product_available_stock to anon, authenticated;

comment on view product_available_stock is
  'Real-time available stock = product.stock_quantity minus active, unexpired reservations. Use this in cart refresh and createCheckoutSession. Grants: anon + authenticated SELECT (mirrors products table grants).';
