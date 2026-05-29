"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";

/**
 * Server Actions for the order detail page.
 *
 * Lives under the (authed) group so middleware + layout have already
 * confirmed an authenticated session before any of these execute.
 *
 * Return shape (discriminated union, matches products/_actions.ts):
 *   { ok: true }
 *   { ok: false, formError?: string }
 *
 * Each action revalidates both list and detail paths on success so
 * the admin sees state changes immediately on next render.
 *
 * Refunds (refundOrder): this action only CREATES the refund at Stripe.
 * The resulting charge.refunded webhook is the single owner of the DB
 * side-effects - it mirrors refunded_pence, flips status to 'refunded'
 * on a full refund, and restocks items, all idempotently (see
 * lib/checkout/process-payment.ts processRefund). We deliberately do not
 * write refunded_pence here to avoid two code paths fighting over the
 * same field; the trade-off is a few seconds of UI lag until the webhook
 * lands.
 */

type ActionResult =
  | { ok: true }
  | { ok: false; formError?: string };

const NOTES_MAX_LENGTH = 2000;

/**
 * Revalidate both the list and the specific detail page. Always
 * called as the last step of a successful action so any data the
 * caller renders next is fresh.
 */
function revalidateOrder(orderId: string): void {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
}

/**
 * Flip an order from paid -> fulfilled. Idempotent: re-running on an
 * already-fulfilled order returns ok without a write (so a refresh
 * mid-action doesn't double-stamp fulfilled_at).
 *
 * We deliberately only allow paid -> fulfilled here. Backorder, refunded,
 * cancelled need different workflows and shouldn't take this path.
 */
export async function markFulfilled(
  orderId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  // Read the current status so we can branch cleanly. .single() because
  // the detail page already verified the row exists; if it has vanished
  // between page load and action call, that's a real error.
  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("status, fulfilled_at")
    .eq("id", orderId)
    .single();

  if (readError || !order) {
    return {
      ok: false,
      formError: "Could not find the order. It may have been deleted.",
    };
  }

  if (order.status === "fulfilled") {
    // Already fulfilled — no-op, but still revalidate in case the
    // caller's view is stale.
    revalidateOrder(orderId);
    return { ok: true };
  }

  if (order.status !== "paid") {
    return {
      ok: false,
      formError: `Cannot mark this order as fulfilled (current status: ${order.status}).`,
    };
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: "fulfilled",
      fulfilled_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (updateError) {
    return {
      ok: false,
      formError: `Could not update the order: ${updateError.message}`,
    };
  }

  revalidateOrder(orderId);
  return { ok: true };
}

/**
 * Reverse markFulfilled: flip fulfilled -> paid, clear fulfilled_at.
 *
 * Admin error-correction path. Same idempotency / status-guard pattern
 * as markFulfilled but in the opposite direction.
 */
export async function markPending(
  orderId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();

  if (readError || !order) {
    return {
      ok: false,
      formError: "Could not find the order. It may have been deleted.",
    };
  }

  if (order.status === "paid") {
    revalidateOrder(orderId);
    return { ok: true };
  }

  if (order.status !== "fulfilled") {
    return {
      ok: false,
      formError: `Cannot revert to paid from status ${order.status}.`,
    };
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: "paid",
      fulfilled_at: null,
    })
    .eq("id", orderId);

  if (updateError) {
    return {
      ok: false,
      formError: `Could not update the order: ${updateError.message}`,
    };
  }

  revalidateOrder(orderId);
  return { ok: true };
}

/**
 * Issue a FULL refund for an order via Stripe.
 *
 * "Full" means the entire outstanding amount: total_pence minus anything
 * already refunded (a prior partial refund issued from the Stripe
 * dashboard leaves status paid/fulfilled but a non-zero refunded_pence,
 * so we refund only the remainder). The charge.refunded webhook then
 * mirrors refunded_pence, flips status to 'refunded', and restocks.
 *
 * Guards:
 *   - order must exist and carry a stripe_payment_intent (older/manual
 *     orders without one cannot be refunded through here)
 *   - status must be paid or fulfilled (refunded/cancelled/backorder
 *     take other paths)
 *   - if already fully refunded, no-op ok (a refresh races the webhook)
 *
 * Idempotency: we pass a Stripe idempotency key keyed on the order id +
 * the refunded_pence we observed, so a double-submit from the same state
 * collapses to a single refund rather than stacking two.
 */
export async function refundOrder(
  orderId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("status, total_pence, refunded_pence, stripe_payment_intent")
    .eq("id", orderId)
    .single();

  if (readError || !order) {
    return {
      ok: false,
      formError: "Could not find the order. It may have been deleted.",
    };
  }

  if (!order.stripe_payment_intent) {
    return {
      ok: false,
      formError:
        "This order has no Stripe payment intent and cannot be refunded here.",
    };
  }

  if (order.status !== "paid" && order.status !== "fulfilled") {
    return {
      ok: false,
      formError: `Cannot refund an order with status ${order.status}.`,
    };
  }

  const remaining = order.total_pence - order.refunded_pence;
  if (remaining <= 0) {
    // Already fully refunded. Treat as a no-op so a click that races the
    // webhook (which will have set status to 'refunded') doesn't error.
    revalidateOrder(orderId);
    return { ok: true };
  }

  try {
    await getStripe().refunds.create(
      {
        payment_intent: order.stripe_payment_intent,
        amount: remaining,
      },
      { idempotencyKey: `refund-${orderId}-${order.refunded_pence}` }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error from Stripe.";
    return {
      ok: false,
      formError: `Stripe refund failed: ${message}`,
    };
  }

  // The webhook owns the DB write; revalidate so the page re-reads once
  // refunded_pence/status land.
  revalidateOrder(orderId);
  return { ok: true };
}

/**
 * Update internal admin notes for an order.
 *
 * Trims whitespace, caps at NOTES_MAX_LENGTH chars. Empty/whitespace-
 * only input clears the notes (writes NULL). Long input is REJECTED
 * rather than silently truncated, so the admin sees an error and
 * decides what to remove.
 */
export async function updateOrderNotes(
  orderId: string,
  notes: string
): Promise<ActionResult> {
  const trimmed = notes.trim();

  if (trimmed.length > NOTES_MAX_LENGTH) {
    return {
      ok: false,
      formError: `Notes are too long (${trimmed.length} chars; limit is ${NOTES_MAX_LENGTH}).`,
    };
  }

  const supabase = await createClient();

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      notes: trimmed.length === 0 ? null : trimmed,
    })
    .eq("id", orderId);

  if (updateError) {
    return {
      ok: false,
      formError: `Could not save notes: ${updateError.message}`,
    };
  }

  revalidateOrder(orderId);
  return { ok: true };
}
