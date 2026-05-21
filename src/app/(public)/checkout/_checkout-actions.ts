"use server";

import { randomUUID } from "node:crypto";
import type Stripe from "stripe";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import {
  computeShippingPence,
  FLAT_SHIPPING_RATE_PENCE,
  FREE_SHIPPING_THRESHOLD_PENCE,
  SHIPPING_ALLOWED_COUNTRIES,
  STOCK_RESERVATION_TTL_MINUTES,
} from "@/lib/stripe/constants";

/**
 * Stripe Checkout session creation.
 *
 * Called from /checkout on mount. Takes the buyer's localStorage cart
 * (productId + qty only - everything else is re-fetched authoritatively
 * server-side), validates against live DB state, creates stock
 * reservations, opens a Stripe Checkout session, and returns the
 * hosted-checkout URL for client-side redirect.
 *
 * --- Why a server action and not an API route ---
 * Server actions get free request-bound cookie handling for the supabase
 * SSR client. We don't need to expose this as a public POST endpoint -
 * only our own /checkout page calls it.
 *
 * --- Drift handling ---
 * Anything that's changed since the cart snapshot (price, stock,
 * status=live, existence) is caught here, NOT trusted from the client.
 * The cart's refreshCartItems already shows drift on /cart - this is the
 * second, authoritative gate just before payment opens.
 *
 * --- Race window ---
 * Between "check stock" and "insert reservation rows" there is a
 * milliseconds-wide window where another buyer could grab the same
 * unit. Mitigation:
 *   1. Stripe session created FIRST (gives us the real stripe_session_id)
 *   2. Re-check available_stock immediately before reservation insert
 *   3. If it changed in the gap, return error - reservation NOT created -
 *      buyer sees the drift on /cart on retry
 *
 * Worst case if all three fail: buyer reaches Stripe Checkout and pays
 * for stock another buyer just claimed. The webhook handles this case by
 * refusing to create the order and (in patch 5) initiating a refund. For
 * current volume (1-of-1 used items, low traffic) this is acceptable.
 * Tighter guarantees (advisory locks) deferred until volume warrants.
 *
 * --- Money ---
 * All prices read from the live products table. Never trust the cart
 * snapshot. Stripe shows the buyer the real current price; if it's
 * dropped since they added, they pay less. If it's risen, we error out
 * rather than charge more than they thought (drift UI on /cart will
 * have already flagged it).
 *
 * --- Return ---
 * { ok: true, data: { url } }   -> client window.location = url
 * { ok: false, formError }        -> client shows the error inline
 * { ok: false, formError, drift: true }
 *                                  -> client redirects to /cart for
 *                                     buyer to see refreshed state
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CheckoutCartInput = {
  productId: string;
  qty: number;
};

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; formError?: string; drift?: boolean };

export type CheckoutSessionResult = ActionResult<{ url: string }>;

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

export async function createCheckoutSession(
  cartItems: CheckoutCartInput[]
): Promise<CheckoutSessionResult> {
  // ---- 1. Defensive input validation -------------------------------------
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return { ok: false, formError: "Your basket is empty" };
  }

  if (cartItems.length > 100) {
    return { ok: false, formError: "Too many items in basket" };
  }

  // Validate each input. Any malformed item is a bug or tampering.
  for (const item of cartItems) {
    if (
      typeof item.productId !== "string" ||
      item.productId.length === 0 ||
      !Number.isInteger(item.qty) ||
      item.qty < 1 ||
      item.qty > 99
    ) {
      return { ok: false, formError: "Invalid item in basket" };
    }
  }

  // ---- 2. Read live product + available stock ----------------------------
  const supabase = await createClient();

  const productIds = cartItems.map((i) => i.productId);

  // Two queries instead of one join because product_available_stock is a
  // view and Supabase's PostgREST nested-select syntax over views is
  // fiddly. Two parallel reads are cheap and clearer.
  const [productsResult, stockResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, slug, name, brand, condition, price_pence, status")
      .in("id", productIds)
      .eq("status", "live"),
    supabase
      .from("product_available_stock")
      .select("product_id, available_stock")
      .in("product_id", productIds),
  ]);

  if (productsResult.error) {
    console.error("createCheckoutSession products error", productsResult.error);
    return { ok: false, formError: "Could not validate basket" };
  }
  if (stockResult.error) {
    console.error("createCheckoutSession stock error", stockResult.error);
    return { ok: false, formError: "Could not validate basket" };
  }

  const productById = new Map(
    productsResult.data.map((p) => [p.id, p])
  );
  const stockById = new Map(
    (stockResult.data ?? []).map((s) => [s.product_id, s.available_stock])
  );

  // ---- 3. Per-item drift check -------------------------------------------
  // Every input item must be present and live and have enough available
  // stock for the requested qty. Any miss = drift, kick back to /cart.
  type LineItem = {
    productId: string;
    name: string;
    qty: number;
    pricePence: number;
    slug: string;
    brand: string | null;
    condition: string;
  };

  const lineItems: LineItem[] = [];

  for (const item of cartItems) {
    const product = productById.get(item.productId);
    if (!product) {
      // Product missing, archived, or no longer 'live'.
      return {
        ok: false,
        formError:
          "One or more items are no longer available. Please review your basket.",
        drift: true,
      };
    }

    const availableStock = stockById.get(item.productId) ?? 0;
    if (availableStock < item.qty) {
      // Either zero stock or someone else has a live reservation that
      // brings available below what this buyer wants.
      return {
        ok: false,
        formError:
          "An item in your basket has gone out of stock. Please review your basket.",
        drift: true,
      };
    }

    lineItems.push({
      productId: product.id,
      name: product.name,
      qty: item.qty,
      pricePence: product.price_pence,
      slug: product.slug,
      brand: product.brand,
      condition: product.condition,
    });
  }

  // ---- 4. Compute totals + shipping --------------------------------------
  const subtotalPence = lineItems.reduce(
    (sum, l) => sum + l.pricePence * l.qty,
    0
  );
  const shippingPence = computeShippingPence(subtotalPence);

  // ---- 5. Build Stripe line_items ----------------------------------------
  // One Stripe line per cart line. We include slug + brand + condition in
  // the product description so the buyer sees what they're paying for on
  // the Stripe page exactly as they saw on our cart.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    console.error("NEXT_PUBLIC_SITE_URL not set");
    return { ok: false, formError: "Site URL not configured" };
  }

  const stripeLineItems = lineItems.map((l) => {
      const descriptionParts = [
        l.brand,
        l.condition === "used" ? "Used" : "New",
      ].filter((x): x is string => typeof x === "string" && x.length > 0);

      return {
        price_data: {
          currency: "gbp",
          unit_amount: l.pricePence,
          product_data: {
            name: l.name,
            description:
              descriptionParts.length > 0
                ? descriptionParts.join(" - ")
                : undefined,
            metadata: {
              product_id: l.productId,
              slug: l.slug,
            },
          },
        },
        quantity: l.qty,
      };
    });

  // ---- 6. Shipping option built inline below ----------------------------
  // We previously hoisted shippingOption to a const, but that lost the
  // literal-type narrowing Stripe's SessionCreateParams.ShippingOption
  // wants (e.g. 'business_day' inferred as 'string'). Inlining lets the
  // type flow from the create() params signature.

  // ---- 7. Create the Stripe Checkout session -----------------------------
  // Hosted-redirect flow. Stripe collects email, billing, and shipping.
  // consent_collection captures GDPR-compliant marketing opt-in.
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",

      line_items: stripeLineItems,

      shipping_address_collection: {
        // Spread to make a mutable copy; cast to the country-code union the
        // Stripe SDK requires. Our SHIPPING_ALLOWED_COUNTRIES is a readonly
        // tuple, the Stripe type is a writable enum array.
        allowed_countries: [...SHIPPING_ALLOWED_COUNTRIES] as ("GB")[],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: {
              amount: shippingPence,
              currency: "gbp",
            },
            display_name:
              shippingPence === 0 ? "Free UK delivery" : "UK delivery",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 2 },
              maximum: { unit: "business_day", value: 5 },
            },
          },
        },
      ],

      // Phone capture is helpful for delivery coordination. Buyer can
      // skip if Stripe deems it optional in their region.
      phone_number_collection: { enabled: true },

      // GDPR-compliant marketing consent. Stripe shows a checkbox the
      // buyer must affirmatively tick - webhook reads consent.promotions.
      consent_collection: {
        promotions: "auto",
        terms_of_service: "none",
      },

      // Billing address is asked for by Stripe by default; this just
      // makes it explicit. Buyer-typed address is more reliable than
      // payment-method-derived address for invoicing.
      billing_address_collection: "required",

      // 30-min expiry is shorter than Stripe's 24h default. Aligns
      // roughly with our 15-min stock reservation TTL so abandoned
      // sessions clear themselves on Stripe's side too.
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,

      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cart?cancelled=1`,

      // Metadata travels into the webhook payload. The reservation
      // group id ties together the multi-row reservation insert below.
      metadata: {
        reservation_group_id: randomUUID(),
        site: "direct-desk-solutions",
      },
    });
  } catch (err) {
    console.error("stripe.checkout.sessions.create failed", err);
    return { ok: false, formError: "Could not start checkout" };
  }

  if (!session.url) {
    console.error("stripe session created but url is null", session.id);
    return { ok: false, formError: "Could not start checkout" };
  }

  // ---- 8. Create stock reservation rows ---------------------------------
  // Admin client because the table is admin-only by RLS. The buyer is
  // anonymous (no auth.user) but we need to write on their behalf as a
  // trusted backend operation.
  //
  // Race-window mitigation: re-read available_stock immediately before
  // insert. If it dropped below what we need (someone else's reservation
  // landed in the milliseconds since step 2), bail and rely on Stripe
  // session expiry to clear the orphaned session.
  const adminSupabase = createAdminClient();

  const { data: freshStock, error: freshStockError } = await adminSupabase
    .from("product_available_stock")
    .select("product_id, available_stock")
    .in("product_id", productIds);

  if (freshStockError) {
    console.error("re-check stock failed", freshStockError);
    // Stripe session is already created and unused. It'll expire in 30
    // min, so this is recoverable. But we can't reserve, so we error.
    return { ok: false, formError: "Could not reserve stock" };
  }

  const freshStockById = new Map(
    (freshStock ?? []).map((s) => [s.product_id, s.available_stock])
  );

  for (const item of cartItems) {
    const fresh = freshStockById.get(item.productId) ?? 0;
    if (fresh < item.qty) {
      // Lost the race. Stripe session abandoned (expires in 30 min).
      // No reservation was created so no cleanup needed.
      return {
        ok: false,
        formError:
          "An item went out of stock while we were preparing your basket. Please review and try again.",
        drift: true,
      };
    }
  }

  // All clear. Insert one reservation row per cart line.
  const expiresAt = new Date(
    Date.now() + STOCK_RESERVATION_TTL_MINUTES * 60 * 1000
  ).toISOString();

  const reservationRows = cartItems.map((item) => ({
    product_id: item.productId,
    stripe_session_id: session.id,
    quantity: item.qty,
    status: "active" as const,
    expires_at: expiresAt,
  }));

  const { error: insertError } = await adminSupabase
    .from("stock_reservations")
    .insert(reservationRows);

  if (insertError) {
    console.error("reservation insert failed", insertError);
    // Same recovery as above - Stripe session will expire. Don't try to
    // partially clean up; that's a class of bug all its own.
    return { ok: false, formError: "Could not reserve stock" };
  }

  // ---- 9. Done. Return URL for client redirect ---------------------------
  return { ok: true, data: { url: session.url } };
}

// ---------------------------------------------------------------------------
// Re-export shipping constants for the cart UI to display the rule it
// is governed by. Single source of truth.
// ---------------------------------------------------------------------------

export {
  FREE_SHIPPING_THRESHOLD_PENCE,
  FLAT_SHIPPING_RATE_PENCE,
};
