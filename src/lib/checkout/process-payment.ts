import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import type { OrderConfirmationPayload } from "@/lib/email/order-confirmation";

/**
 * Stripe checkout.session.completed handler.
 *
 * Called by /api/stripe/webhook after signature verification. Pure
 * business logic - no HTTP concerns - so it can be re-used / tested
 * independently of the route handler.
 *
 * --- Flow ---
 *  1. Idempotency: if an order row already exists for this
 *     stripe_session_id, return early (200). Stripe retries failed
 *     webhooks for up to 3 days and may also deliver duplicates.
 *  2. Re-fetch the session via the SDK with expand: ['line_items']
 *     so we have authoritative line item amounts.
 *  3. Load this session's stock_reservations rows. These are the
 *     source of truth for "what was ordered" - the action wrote them
 *     when the buyer clicked Checkout, and they carry product_id +
 *     quantity. We do NOT rely on Stripe's line_items metadata for
 *     product IDs because hosted Checkout strips price_data.metadata
 *     on retrieve.
 *  4. Stock shortfall check: for each product, compute
 *        available = stock_quantity - sum(other_active_reservations)
 *     where "other" excludes this session's own reservations. If any
 *     product is short, route to the backorder branch (status =
 *     'backorder', notes populated, stock NOT decremented).
 *  5. UPSERT customer by lowercased email, maintain aggregates.
 *  6. Insert the orders row.
 *  7. Insert order_items rows (snapshot product details + hero image).
 *  8. If paid: decrement products.stock_quantity per line item, mark
 *     reservations status='confirmed'.
 *     If backorder: leave stock alone, mark reservations 'cancelled'.
 *
 * --- Error handling ---
 * Any mid-flow database error throws. The route handler catches and
 * returns 500. Stripe retries. The orders.stripe_session_id unique
 * constraint provides idempotency on retry: if we managed to insert
 * the order before the failure, the next retry hits step 1 and exits
 * clean. If we did not, the retry starts fresh.
 *
 * --- Transactions ---
 * Supabase's PostgREST client does not expose true transactions, so
 * sequential writes are the best we can do. A failure between order
 * insert and order_items insert is a small leak (an order row with
 * no items), but the unique constraint prevents duplicates and the
 * admin order detail page will surface the inconsistency.
 */
export async function processCheckoutCompleted(
  event: Stripe.Event
): Promise<
  | { orderId: string; backorder: boolean; emailPayload: OrderConfirmationPayload }
  | { skipped: string }
> {
  if (event.type !== "checkout.session.completed") {
    return { skipped: `event type ${event.type} not handled` };
  }

  const sessionFromEvent = event.data.object as Stripe.Checkout.Session;
  const sessionId = sessionFromEvent.id;

  const admin = createAdminClient();

  // ---------- 1. Idempotency check ----------
  const { data: existing, error: existingErr } = await admin
    .from("orders")
    .select("id")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (existingErr) {
    throw new Error(
      `Idempotency check failed for ${sessionId}: ${existingErr.message}`
    );
  }
  if (existing) {
    return { skipped: `order already exists for session ${sessionId}` };
  }

  // ---------- 2. Re-fetch the session with line items ----------
  const session = await getStripe().checkout.sessions.retrieve(sessionId, {
    expand: ["line_items"],
  });

  if (session.payment_status !== "paid") {
    return {
      skipped: `session ${sessionId} payment_status is ${session.payment_status}, not paid`,
    };
  }

  // ---------- 3. Load this session's reservations ----------
  const { data: reservations, error: reservationsErr } = await admin
    .from("stock_reservations")
    .select("id, product_id, quantity, status")
    .eq("stripe_session_id", sessionId);

  if (reservationsErr) {
    throw new Error(
      `Reservation lookup failed for ${sessionId}: ${reservationsErr.message}`
    );
  }
  if (!reservations || reservations.length === 0) {
    throw new Error(
      `No reservations found for session ${sessionId} - cannot determine ordered items`
    );
  }

  const productIds = reservations.map((r) => r.product_id);

  // ---------- 4. Load product details + stock check ----------
  const { data: products, error: productsErr } = await admin
    .from("products")
    .select(
      "id, name, sku, brand, condition, condition_grade, slug, price_pence, stock_quantity"
    )
    .in("id", productIds);

  if (productsErr) {
    throw new Error(
      `Product lookup failed for ${sessionId}: ${productsErr.message}`
    );
  }
  if (!products || products.length !== productIds.length) {
    throw new Error(
      `Missing products for session ${sessionId} (expected ${productIds.length}, got ${products?.length ?? 0})`
    );
  }
  const productById = new Map(products.map((p) => [p.id, p]));

  // For each product, compute available_for_us = stock_quantity minus
  // OTHER active reservations (excluding this session's own).
  const { data: otherReservations, error: otherErr } = await admin
    .from("stock_reservations")
    .select("product_id, quantity")
    .in("product_id", productIds)
    .eq("status", "active")
    .neq("stripe_session_id", sessionId)
    .gt("expires_at", new Date().toISOString());

  if (otherErr) {
    throw new Error(
      `Other-reservations lookup failed for ${sessionId}: ${otherErr.message}`
    );
  }

  const otherReservedByProduct = new Map<string, number>();
  for (const r of otherReservations ?? []) {
    otherReservedByProduct.set(
      r.product_id,
      (otherReservedByProduct.get(r.product_id) ?? 0) + r.quantity
    );
  }

  // Build per-line shortfall report. Each line either has enough stock
  // for our quantity or it does not. If any line is short, the whole
  // order is backorder.
  type Shortfall = {
    productId: string;
    name: string;
    sku: string;
    ordered: number;
    available: number;
  };
  const shortfalls: Shortfall[] = [];
  for (const r of reservations) {
    const product = productById.get(r.product_id);
    if (!product) continue;
    const otherReserved = otherReservedByProduct.get(r.product_id) ?? 0;
    const available = product.stock_quantity - otherReserved;
    if (available < r.quantity) {
      shortfalls.push({
        productId: r.product_id,
        name: product.name,
        sku: product.sku,
        ordered: r.quantity,
        available,
      });
    }
  }

  const isBackorder = shortfalls.length > 0;

  // ---------- 5. UPSERT customer by lowercased email ----------
  const customerDetails = session.customer_details;
  if (!customerDetails?.email) {
    throw new Error(
      `Session ${sessionId} has no customer_details.email - cannot upsert customer`
    );
  }
  const email = customerDetails.email.toLowerCase().trim();
  const fullName = (customerDetails.name ?? "").trim();
  const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
  const lastName = rest.length > 0 ? rest.join(" ") : null;

  const totalPence = session.amount_total ?? 0;

  // Marketing consent. Stripe's hosted Checkout returns consent values
  // on session.consent (when consent_collection is enabled). Defensive
  // about shape - fall back to false if anything is missing.
  const promoConsent =
    session.consent?.promotions === "opt_in" ? true : false;
  const nowIso = new Date().toISOString();

  // Read any existing customer row to preserve first_order_at and
  // maintain accurate aggregates.
  const { data: existingCustomer, error: existingCustErr } = await admin
    .from("customers")
    .select(
      "id, total_orders, total_spent_pence, first_order_at, marketing_consent"
    )
    .eq("email", email)
    .maybeSingle();

  if (existingCustErr) {
    throw new Error(
      `Customer lookup failed for ${email}: ${existingCustErr.message}`
    );
  }

  let customerId: string;
  if (existingCustomer) {
    // Update aggregates. Don't overwrite first_order_at. Marketing
    // consent: only flip true->true or false->true. A subsequent
    // checkout that declines consent does NOT revoke prior consent
    // (revocation is a separate admin action).
    const newMarketing =
      existingCustomer.marketing_consent || promoConsent;
    const { error: updErr } = await admin
      .from("customers")
      .update({
        first_name: firstName || null,
        last_name: lastName,
        phone: customerDetails.phone ?? null,
        marketing_consent: newMarketing,
        marketing_consent_at:
          !existingCustomer.marketing_consent && promoConsent
            ? nowIso
            : undefined,
        total_orders: existingCustomer.total_orders + 1,
        total_spent_pence: existingCustomer.total_spent_pence + totalPence,
        last_order_at: nowIso,
      })
      .eq("id", existingCustomer.id);

    if (updErr) {
      throw new Error(
        `Customer update failed for ${email}: ${updErr.message}`
      );
    }
    customerId = existingCustomer.id;
  } else {
    // Insert new customer. first_order_at = last_order_at = now.
    const { data: insertedCustomer, error: insErr } = await admin
      .from("customers")
      .insert({
        email,
        first_name: firstName || null,
        last_name: lastName,
        phone: customerDetails.phone ?? null,
        marketing_consent: promoConsent,
        marketing_consent_at: promoConsent ? nowIso : null,
        total_orders: 1,
        total_spent_pence: totalPence,
        first_order_at: nowIso,
        last_order_at: nowIso,
      })
      .select("id")
      .single();

    if (insErr || !insertedCustomer) {
      throw new Error(
        `Customer insert failed for ${email}: ${insErr?.message ?? "no row"}`
      );
    }
    customerId = insertedCustomer.id;
  }

  // ---------- 6. Build shipping/billing snapshots + notes ----------
  // Stripe v22 (API 2026-04-22.dahlia) moved shipping_details from the
  // top-level Session into Session.collected_information. See L34 banked
  // in Brief 18. Both levels are nullable.
  const collectedShipping =
    session.collected_information?.shipping_details ?? null;
  const shippingAddress = collectedShipping?.address
    ? {
        name: collectedShipping.name ?? null,
        line1: collectedShipping.address.line1 ?? null,
        line2: collectedShipping.address.line2 ?? null,
        city: collectedShipping.address.city ?? null,
        postal_code: collectedShipping.address.postal_code ?? null,
        country: collectedShipping.address.country ?? null,
        state: collectedShipping.address.state ?? null,
      }
    : null;

  const billingAddress = customerDetails.address
    ? {
        name: customerDetails.name ?? null,
        line1: customerDetails.address.line1 ?? null,
        line2: customerDetails.address.line2 ?? null,
        city: customerDetails.address.city ?? null,
        postal_code: customerDetails.address.postal_code ?? null,
        country: customerDetails.address.country ?? null,
        state: customerDetails.address.state ?? null,
      }
    : null;

  let notes: string | null = null;
  if (isBackorder) {
    const lines = shortfalls.map(
      (s) =>
        `- ${s.name} (SKU ${s.sku}) ordered ${s.ordered}, available ${s.available}`
    );
    notes =
      `STOCK SHORTFALL detected at webhook time ${nowIso}.\n` +
      `Order accepted with status='backorder'; stock NOT decremented.\n` +
      `Admin must resolve manually (refund, source replacement, or arrange wait).\n\n` +
      `Affected lines:\n${lines.join("\n")}`;
  }

  // ---------- 7. Insert the orders row ----------
  // Compute subtotal / shipping from session totals. Stripe gives us
  // amount_subtotal (line items before shipping/discounts) and
  // amount_shipping. Both are in the smallest currency unit (pence).
  const subtotalPence = session.amount_subtotal ?? 0;
  const shippingPence =
    session.shipping_cost?.amount_total ??
    Math.max(0, totalPence - subtotalPence);

  const { data: insertedOrder, error: orderErr } = await admin
    .from("orders")
    .insert({
      customer_id: customerId,
      stripe_session_id: sessionId,
      stripe_payment_intent:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
      status: isBackorder ? "backorder" : "paid",
      subtotal_pence: subtotalPence,
      shipping_pence: shippingPence,
      total_pence: totalPence,
      shipping_address: shippingAddress,
      billing_address: billingAddress,
      marketing_consent_order: promoConsent,
      notes,
      paid_at: nowIso,
    })
    .select("id")
    .single();

  if (orderErr || !insertedOrder) {
    throw new Error(
      `Order insert failed for ${sessionId}: ${orderErr?.message ?? "no row"}`
    );
  }
  const orderId = insertedOrder.id;

  // ---------- 8. Insert order_items rows ----------
  // Fetch hero images per product so each snapshot carries product_hero_url.
  const { data: heroImages, error: heroErr } = await admin
    .from("product_images")
    .select("product_id, cloudinary_url")
    .in("product_id", productIds)
    .eq("is_hero", true);

  if (heroErr) {
    throw new Error(
      `Hero image lookup failed for ${sessionId}: ${heroErr.message}`
    );
  }
  const heroByProduct = new Map(
    (heroImages ?? []).map((h) => [h.product_id, h.cloudinary_url])
  );

  const orderItemRows = reservations.map((r) => {
    const product = productById.get(r.product_id);
    if (!product) {
      // Defensive - should never hit because we validated counts above.
      throw new Error(
        `Product ${r.product_id} missing while building order_items`
      );
    }
    return {
      order_id: orderId,
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku,
      product_brand: product.brand,
      product_condition: product.condition,
      product_grade: product.condition_grade,
      product_slug: product.slug,
      product_hero_url: heroByProduct.get(product.id) ?? null,
      unit_price_pence: product.price_pence,
      quantity: r.quantity,
      line_total_pence: product.price_pence * r.quantity,
    };
  });

  const { error: itemsErr } = await admin
    .from("order_items")
    .insert(orderItemRows);

  if (itemsErr) {
    throw new Error(
      `Order items insert failed for ${sessionId}: ${itemsErr.message}`
    );
  }

  // ---------- 9. Stock + reservation status ----------
  if (isBackorder) {
    // Backorder: cancel reservations. Stock untouched.
    const { error: resErr } = await admin
      .from("stock_reservations")
      .update({ status: "cancelled", cancelled_at: nowIso })
      .eq("stripe_session_id", sessionId);
    if (resErr) {
      throw new Error(
        `Reservation cancel failed for ${sessionId}: ${resErr.message}`
      );
    }
  } else {
    // Paid: decrement stock per line item (sequential, no transaction).
    for (const r of reservations) {
      const product = productById.get(r.product_id);
      if (!product) continue;
      const { error: decErr } = await admin
        .from("products")
        .update({ stock_quantity: product.stock_quantity - r.quantity })
        .eq("id", r.product_id);
      if (decErr) {
        throw new Error(
          `Stock decrement failed for product ${r.product_id} on session ${sessionId}: ${decErr.message}`
        );
      }
    }
    // Confirm reservations.
    const { error: resErr } = await admin
      .from("stock_reservations")
      .update({ status: "confirmed", confirmed_at: nowIso })
      .eq("stripe_session_id", sessionId);
    if (resErr) {
      throw new Error(
        `Reservation confirm failed for ${sessionId}: ${resErr.message}`
      );
    }
  }

  // ---------- 10. Build the email payload ----------
  // Everything below is already computed above; we just shape it for
  // the confirmation email. The route handler sends it best-effort.
  const emailPayload: OrderConfirmationPayload = {
    to: email,
    customerName: fullName || null,
    orderId,
    isBackorder,
    items: reservations.map((r) => {
      const product = productById.get(r.product_id)!;
      return {
        name: product.name,
        brand: product.brand,
        condition: product.condition,
        grade: product.condition_grade,
        quantity: r.quantity,
        unitPricePence: product.price_pence,
        lineTotalPence: product.price_pence * r.quantity,
      };
    }),
    subtotalPence,
    shippingPence,
    totalPence,
    shippingAddress: shippingAddress
      ? {
          name: shippingAddress.name,
          line1: shippingAddress.line1,
          line2: shippingAddress.line2,
          city: shippingAddress.city,
          postalCode: shippingAddress.postal_code,
          country: shippingAddress.country,
        }
      : null,
  };

  return { orderId, backorder: isBackorder, emailPayload };
}
