-- 0011_stripe_tables_service_role_grants.sql
-- Grant service_role full access to the Stripe checkout / orders tables.
--
-- Same root cause as 0004: the Supabase project has "Auto-expose new tables"
-- disabled, so tables created in 0008 (customers, orders, order_items,
-- stock_reservations) and the product_available_stock view have NO grants
-- for service_role. Our admin Supabase client (createAdminClient(), backed
-- by SUPABASE_SECRET_KEY) identifies as service_role, so every query from
-- the checkout server action and the Stripe webhook hits
-- "42501 permission denied".
--
-- Observed symptom: createCheckoutSession returns {ok: false, formError:
-- "Could not reserve stock"} because either the re-check against
-- product_available_stock OR the insert into stock_reservations fails.
-- The webhook (process-payment.ts) would have failed the same way the
-- moment a real payment came in, with no order rows ever written.
--
-- 0010 fixed the anon/authenticated read of product_available_stock so the
-- earlier client-side stock view query works. This migration fixes the
-- service_role side, which 0010 did not address.
--
-- Granting all four CRUD verbs to mirror the 0004 pattern. service_role
-- bypasses RLS by design; any access restrictions for it belong in
-- explicit policies, not in the absence of grants.

grant select, insert, update, delete on public.customers           to service_role;
grant select, insert, update, delete on public.orders              to service_role;
grant select, insert, update, delete on public.order_items         to service_role;
grant select, insert, update, delete on public.stock_reservations  to service_role;

-- Views support SELECT only. Grant explicitly because 0010 only granted
-- anon and authenticated; service_role queries the view from the
-- createCheckoutSession race-window re-check.
grant select on public.product_available_stock to service_role;
