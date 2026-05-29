import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripe, getWebhookSecret } from "@/lib/stripe/server";
import { processCheckoutCompleted } from "@/lib/checkout/process-payment";
import { sendOrderConfirmation } from "@/lib/email/order-confirmation";

/**
 * Stripe webhook endpoint - POST /api/stripe/webhook.
 *
 * Stripe dashboard sends events to this URL with a stripe-signature
 * header that we verify against DDS_STRIPE_WEBHOOK_SECRET. Verified
 * checkout.session.completed events are dispatched to
 * processCheckoutCompleted (in src/lib/checkout/process-payment.ts).
 *
 * --- Why force-dynamic + nodejs runtime ---
 * The webhook MUST read the raw request body via req.text() so we
 * can verify the Stripe signature against the exact bytes Stripe
 * signed. Any JSON parsing or middleware-level body handling would
 * mutate the bytes and break verification. force-dynamic prevents
 * Next from caching anything; nodejs runtime gives us crypto for
 * the SDK's signature verification.
 *
 * --- Why we return 200 on event types we do not handle ---
 * Returning non-2xx tells Stripe to retry. We do NOT want retries
 * for events we have decided not to process. We will probably handle
 * charge.refunded and payment_intent.payment_failed in a future
 * session - for now they get a polite 200 with skipped=true.
 *
 * --- Why processing errors return 500 ---
 * Stripe retries 5xx for up to 3 days with exponential backoff.
 * Our orders.stripe_session_id unique constraint provides
 * idempotency on retry. Any business-logic failure is therefore
 * recoverable: log, return 500, Stripe retries, we either complete
 * cleanly or hit the idempotency early-exit.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.error("webhook: missing stripe-signature header");
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  // CRITICAL: read the raw body as text. Calling req.json() would
  // re-serialise and break Stripe's signature check, which is
  // computed against the exact bytes sent.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      getWebhookSecret()
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("webhook: signature verification failed", { msg });
    return NextResponse.json(
      { error: `Signature verification failed: ${msg}` },
      { status: 400 }
    );
  }

  // Currently we only handle checkout.session.completed. Other events
  // get 200 + skipped=true so Stripe stops retrying.
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({
      received: true,
      skipped: true,
      reason: `event type ${event.type} not handled`,
    });
  }

  try {
    const result = await processCheckoutCompleted(event);
    if ("skipped" in result) {
      return NextResponse.json({ received: true, skipped: true, reason: result.skipped });
    }
    // Best-effort order confirmation email. A send failure must NOT
    // propagate: throwing here would return 500, Stripe would retry,
    // and the idempotency early-exit means the order would NOT be
    // re-written but the email WOULD be re-sent => duplicate emails.
    // So we log and swallow. The order write is the source of truth;
    // the email is a courtesy.
    try {
      const emailResult = await sendOrderConfirmation(result.emailPayload);
      if (!emailResult.ok) {
        console.error("webhook: order confirmation email failed", {
          orderId: result.orderId,
          error: emailResult.error,
        });
      }
    } catch (emailErr) {
      const emsg =
        emailErr instanceof Error ? emailErr.message : String(emailErr);
      console.error("webhook: order confirmation email threw", {
        orderId: result.orderId,
        error: emsg,
      });
    }

    return NextResponse.json({
      received: true,
      orderId: result.orderId,
      backorder: result.backorder,
    });
  } catch (err) {
    // Log the full error for the Netlify function logs, but return a
    // generic 500 so Stripe retries.
    const msg = err instanceof Error ? err.message : String(err);
    console.error("webhook: processCheckoutCompleted failed", {
      eventId: event.id,
      msg,
    });
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
