-- Migration 0009: add 'backorder' to order_status enum.
--
-- Background: the Stripe webhook flow can detect that available stock
-- went negative between createCheckoutSession (which reserves) and
-- checkout.session.completed (which confirms). The race window is
-- milliseconds wide and unlikely at current volume, but real.
--
-- Decision (per Brief 17, locked in Session 11):
--   B - Create the order anyway with status='backorder', flag for
--       admin via notes, do NOT decrement stock. William resolves
--       manually (refund, source replacement, or arrange wait).
--
-- This migration is additive only - it adds 'backorder' alongside the
-- existing values without altering any rows. PostgreSQL enum alter is
-- transactional and safe to run idempotently if we ever re-apply.
--
-- The webhook writes orders.notes with shortfall details when it sets
-- status='backorder', so the admin order detail page surfaces what
-- happened without extra plumbing.

alter type order_status add value if not exists 'backorder';

comment on type order_status is
  'Order lifecycle status. backorder = payment captured but stock unavailable; admin resolves manually.';
