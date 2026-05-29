import type { Metadata } from "next";
import Link from "next/link";

import { getStripe } from "@/lib/stripe/server";
import { formatPence } from "@/lib/products/format";
import { getAppSettings } from "@/lib/settings/fetch";
import Breadcrumb from "../../_Breadcrumb";
import ClearCartOnMount from "./_ClearCartOnMount";

export const metadata: Metadata = {
  title: "Order confirmed",
  description: "Thank you for your Direct Desk Solutions order.",
  robots: {
    index: false,
    follow: true,
  },
};

interface SuccessPageProps {
  searchParams: Promise<{
    session_id?: string;
  }>;
}

/**
 * /checkout/success?session_id=cs_test_...
 *
 * Stripe hosted Checkout redirects here on successful payment. The
 * session_id query param comes from Stripe via the success_url
 * template we set in createCheckoutSession.
 *
 * --- Why we read from Stripe, not our orders table ---
 * The webhook (patch 5c) writes the orders row. Webhook delivery is
 * usually sub-second but not guaranteed simultaneous with the buyer
 * redirect. Reading the session directly from Stripe gives us a
 * reliable summary that does not race the webhook.
 *
 * The webhook job is to write the order row + decrement stock + flag
 * backorders for William. This page job is to confirm to the buyer
 * that their payment succeeded.
 *
 * --- session_id is untrusted ---
 * It comes from the URL. A buyer who bookmarks this page or pastes a
 * tampered session ID gets the "could not confirm" branch, not a fake
 * success screen.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: SuccessPageProps) {
  const params = await searchParams;
  const sessionId = params.session_id;
  const { contact_email: contactEmail } = await getAppSettings();

  // No session_id at all - buyer arrived here by mistake.
  if (!sessionId) {
    return <UnconfirmedView reason="missing" contactEmail={contactEmail} />;
  }

  // Retrieve from Stripe. expand line_items so we can render a summary
  // without an extra round-trip to listLineItems.
  let session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ["line_items", "line_items.data.price.product"],
    });
  } catch (error) {
    console.error("checkout success: stripe retrieve failed", {
      sessionId,
      error,
    });
    return (
      <UnconfirmedView reason="retrieve-failed" contactEmail={contactEmail} />
    );
  }

  // Stripe returns sessions in many states. We only render success for
  // a session that has actually been paid.
  if (session.payment_status !== "paid") {
    return <UnconfirmedView reason="not-paid" contactEmail={contactEmail} />;
  }

  const lineItems = session.line_items?.data ?? [];
  const totalPence = session.amount_total ?? 0;
  const customerEmail = session.customer_details?.email ?? null;

  return (
    <div className="mx-auto max-w-7xl px-6 pt-6 pb-24">
      <ClearCartOnMount />

      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Order confirmed" },
        ]}
      />

      <div className="mt-16 lg:mt-24 max-w-2xl mx-auto">
        <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-brand-red mb-4 text-center">Payment received</p>
        <h1 className="font-display text-3xl sm:text-4xl tracking-tight leading-tight text-ink mb-6 text-center">Thanks for your order</h1>
        <p className="text-base text-ink/70 leading-relaxed mb-12 text-center">
          {customerEmail ? (
            <>
              A confirmation will be sent to{" "}
              <span className="font-semibold text-ink">{customerEmail}</span>
              {" "}shortly. We&rsquo;ll be in touch within one working day to
              arrange delivery.
            </>
          ) : (
            <>
              We&rsquo;ll be in touch within one working day to arrange
              delivery.
            </>
          )}
        </p>

        {lineItems.length > 0 && (
          <div className="border-t border-rule pt-6 mb-10">
            <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink/50 mb-4">Your order</p>
            <ul className="divide-y divide-rule">
              {lineItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-baseline justify-between py-3"
                >
                  <span className="text-sm text-ink pr-4">
                    {item.description ?? "Item"}
                    {item.quantity && item.quantity > 1 && (
                      <span className="text-ink/50">
                        {" "}× {item.quantity}
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-semibold text-ink tabular-nums whitespace-nowrap">
                    {formatPence(item.amount_total ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline justify-between pt-4 mt-2 border-t border-rule">
              <span className="text-[11px] uppercase tracking-[0.22em] font-bold text-ink">Total paid</span>
              <span className="text-lg font-bold text-ink tabular-nums">{formatPence(totalPence)}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <Link
            href="/products"
            className="inline-block bg-brand-red text-paper text-[11px] uppercase tracking-[0.22em] font-bold py-4 px-8 hover:bg-ink transition-colors text-center"
          >
            Continue browsing
          </Link>
          <a
            href={`mailto:${contactEmail}?subject=Order%20query`}
            className="inline-block border border-ink/20 text-ink text-[11px] uppercase tracking-[0.22em] font-bold py-4 px-8 hover:bg-ink hover:text-paper transition-colors text-center"
          >
            Email support
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Rendered when we cannot confirm a paid order - missing session_id,
 * Stripe retrieve failed, or session is not in paid status. We do NOT
 * tell the buyer "your payment failed" because we genuinely do not know
 * what happened (could be a stale bookmark, could be a card decline,
 * could be a refund). Polite, accurate, escalates to email.
 */
function UnconfirmedView({
  reason,
  contactEmail,
}: {
  reason: "missing" | "retrieve-failed" | "not-paid";
  contactEmail: string;
}) {
  return (
    <div className="mx-auto max-w-7xl px-6 pt-6 pb-24">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Order status" },
        ]}
      />
      <div className="mt-16 lg:mt-24 max-w-xl mx-auto text-center">
        <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink/50 mb-4">Order status</p>
        <h1 className="font-display text-3xl sm:text-4xl tracking-tight leading-tight text-ink mb-6">We couldn&rsquo;t confirm this order</h1>
        <p className="text-base text-ink/70 leading-relaxed mb-10">
          {reason === "not-paid"
            ? "Your payment hasn’t been confirmed yet. If you completed checkout, our team will be in touch by email shortly."
            : "We couldn’t look up the order details. If you completed payment, please email us and we’ll sort it out."}
        </p>
        <a
          href={`mailto:${contactEmail}?subject=Order%20status%20query`}
          className="inline-block bg-brand-red text-paper text-[11px] uppercase tracking-[0.22em] font-bold py-4 px-8 hover:bg-ink transition-colors"
        >
          Email us
        </a>
      </div>
    </div>
  );
}
