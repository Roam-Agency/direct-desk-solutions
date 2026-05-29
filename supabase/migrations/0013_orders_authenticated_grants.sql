-- ============================================================================
-- Migration 0013: grant the authenticated (admin) role data access on the
-- orders/customers tables.
--
-- Migration 0008 created customers, orders, order_items and stock_reservations
-- with RLS enabled and "authenticated users can manage …" policies, but only
-- ever granted table privileges to service_role. RLS is necessary-but-not-
-- sufficient: Postgres checks table GRANTs *before* RLS, so a query made as the
-- authenticated role hits `permission denied for table orders` before the
-- policy is ever evaluated.
--
-- The admin pages read/write these tables via the publishable-key client, which
-- runs as the authenticated role (createClient() in lib/supabase/server.ts).
-- The Stripe webhook is unaffected — it uses the service-role client
-- (createAdminClient()), which already had its grants and bypasses RLS.
--
-- Symptom this fixes: the admin Orders and Customers pages, the fulfilment
-- toggle, and the in-app refund action all failing with "permission denied for
-- table …" in any environment built from migrations as written.
--
-- Idempotent: re-granting an existing privilege is a no-op, so this is safe to
-- run repeatedly. The matching RLS policies and service_role grants already
-- exist from migration 0008 and are intentionally not repeated here.
-- ============================================================================

grant select, insert, update, delete on customers          to authenticated;
grant select, insert, update, delete on orders             to authenticated;
grant select, insert, update, delete on order_items        to authenticated;
grant select, insert, update, delete on stock_reservations to authenticated;

-- Nudge PostgREST to refresh its schema cache so the API picks up the new
-- privileges without waiting for the periodic reload.
notify pgrst, 'reload schema';
