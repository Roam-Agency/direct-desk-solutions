/**
 * Stripe checkout + shipping constants.
 *
 * Single source of truth so the cart UI, the Stripe Checkout session,
 * and the admin reporting can't disagree about pricing rules.
 *
 * To change shipping pricing later: edit one of the two constants
 * below. Everything reads from here.
 */

// Shipping threshold + flat rate, in pence (codebase convention).
//
// Free over £500, £29 flat under. Decision recorded in Session 10
// brief; revisit when delivery costs are better understood, e.g. once
// real order data shows the new-vs-used mix and the typical basket
// composition.
export const FREE_SHIPPING_THRESHOLD_PENCE = 50000;   // £500
export const FLAT_SHIPPING_RATE_PENCE = 2900;         // £29

/**
 * Stock reservation TTL when a Stripe Checkout session is created.
 * Stripe sessions themselves default to 24h expiry, but we shorten the
 * stock hold to 15 minutes so abandoned baskets don't ghost inventory.
 *
 * If the buyer completes payment within 15 minutes, the webhook flips
 * the reservation to 'confirmed' and decrements stock permanently.
 * Beyond 15 minutes, the reservation is treated as expired (lazy expiry
 * via product_available_stock view) and a buyer can still pay if no
 * one else has claimed the stock in the meantime — we just don't
 * guarantee it.
 */
export const STOCK_RESERVATION_TTL_MINUTES = 15;

/**
 * Compute shipping cost in pence for a given subtotal in pence.
 * Free over threshold, flat rate otherwise.
 *
 *   subtotal £499  → £29 shipping
 *   subtotal £500  → free
 *   subtotal £650  → free
 *
 * The site-wide free-shipping switch (managed in /admin/settings, used for
 * flash sales) short-circuits everything: when active, all orders ship free
 * regardless of subtotal.
 */
export function computeShippingPence(
  subtotalPence: number,
  { freeShippingActive = false }: { freeShippingActive?: boolean } = {}
): number {
  if (freeShippingActive) return 0;
  if (subtotalPence >= FREE_SHIPPING_THRESHOLD_PENCE) return 0;
  return FLAT_SHIPPING_RATE_PENCE;
}

/**
 * GB-only delivery for v1. Stripe Checkout's
 * shipping_address_collection is restricted to this list. Add more
 * countries later if/when international shipping is supported —
 * needs corresponding shipping_options tiers per country.
 */
export const SHIPPING_ALLOWED_COUNTRIES = ["GB"] as const;
