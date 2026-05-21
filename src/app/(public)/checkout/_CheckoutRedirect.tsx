"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useCart } from "@/lib/cart/store";
import { createCheckoutSession } from "./_checkout-actions";

/**
 * Checkout redirector.
 *
 * Buyers land on /checkout from the cart's "Checkout" button. This
 * component immediately hands them off to Stripe-hosted Checkout (or
 * back to /cart on drift). It is deliberately UI-light: a centred
 * spinner with reassuring copy, because the buyer should only ever
 * see it for ~half a second on a healthy network.
 *
 * --- Flow ---
 * 1. Wait for cart context to hydrate (`mounted`). Pre-mount we render
 *    blank to avoid SSR/CSR mismatch.
 * 2. If the cart is empty, redirect to /cart (the cart page handles
 *    the empty state - no point creating a Stripe session for nothing).
 * 3. Call createCheckoutSession with { productId, qty } pairs. We
 *    deliberately do NOT send price snapshots or names; the server
 *    re-fetches everything authoritatively. Sending less is safer.
 * 4. On `ok: true` -> window.location.assign(url) to hand off to
 *    Stripe. We use a full document navigation (not router.push)
 *    because we are leaving the origin.
 * 5. On `ok: false, drift: true` -> router.push("/cart?drift=1")
 *    so /cart re-runs its refresh and shows the drifted items.
 * 6. On any other failure -> show inline error with a manual retry
 *    button. We do NOT auto-retry because each call creates a Stripe
 *    session and stock reservations; retrying silently could double
 *    up.
 *
 * --- Effect discipline ---
 * One `started` ref-equivalent state flag prevents the effect from
 * firing twice (StrictMode dev double-invoke, or if cart hydration
 * fires `mounted` more than once for some reason). Without this we
 * could create two Stripe sessions on the same /checkout visit.
 */

type Status =
  | { kind: "idle" }
  | { kind: "redirecting" }
  | { kind: "error"; message: string };

export default function CheckoutRedirect() {
  const router = useRouter();
  const { items, mounted } = useCart();
  // Default to "redirecting" since that is what the buyer should see
  // the moment the cart hydrates and we kick off the action. Starting
  // in "idle" would force a synchronous setState inside the effect to
  // transition into "redirecting", which violates React 19's
  // react-hooks/set-state-in-effect rule (banked as L27).
  const [status, setStatus] = useState<Status>({ kind: "redirecting" });
  // Ref-based guard against double-fire. A ref does not trigger a
  // re-render when written, and is the recommended pattern for
  // "have I done this side-effect yet?" flags inside an effect.
  const startedRef = useRef(false);

  useEffect(() => {
    if (!mounted) return;
    if (startedRef.current) return;

    // Empty cart -> back to /cart. The cart page renders its own
    // empty state, so we do not duplicate that copy here.
    if (items.length === 0) {
      router.replace("/cart");
      return;
    }

    startedRef.current = true;

    const payload = items.map((i) => ({
      productId: i.productId,
      qty: i.qty,
    }));

    createCheckoutSession(payload)
      .then((result) => {
        if (result.ok) {
          // Full-document navigation. router.push would not work here -
          // checkout.stripe.com is a different origin.
          window.location.assign(result.data.url);
          return;
        }

        if (result.drift) {
          // Send buyer back to /cart with a marker so /cart can show
          // a "your basket changed" notice on top of the refreshed
          // drift state.
          router.replace("/cart?drift=1");
          return;
        }

        setStatus({
          kind: "error",
          message:
            result.formError ??
            "We could not open the secure payment page. Please try again.",
        });
      })
      .catch((err) => {
        // Server action rejected (uncaught exception server-side, network
        // failure, etc.). Without this catch the spinner would hang
        // forever. Reset the ref guard so the Try again button works.
        console.error("createCheckoutSession threw", err);
        startedRef.current = false;
        setStatus({
          kind: "error",
          message:
            "We could not open the secure payment page. Please try again.",
        });
      });
  }, [mounted, items, router]);

  // Retry handler: reset the ref guard and restore the redirecting
  // state so the effect picks up on the next render. setStatus here
  // is in an event handler (button onClick), not an effect, so the
  // set-state-in-effect rule does not apply.
  const retry = () => {
    startedRef.current = false;
    setStatus({ kind: "redirecting" });
  };

  // Pre-mount or empty-cart-redirect-in-flight: render nothing visible
  // so we do not flash a spinner that disappears before it registers.
  if (!mounted || (mounted && items.length === 0)) {
    return null;
  }

  if (status.kind === "error") {
    return (
      <div className="mt-16 lg:mt-24 max-w-xl mx-auto text-center">
        <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-brand-red mb-4">
          Something went wrong
        </p>
        <h1 className="font-display text-3xl sm:text-4xl tracking-tight leading-tight text-ink mb-6">
          Could not open checkout
        </h1>
        <p className="text-base text-ink/70 leading-relaxed mb-10">
          {status.message}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <button
            type="button"
            onClick={retry}
            className="inline-block bg-brand-red text-paper text-[11px] uppercase tracking-[0.22em] font-bold py-4 px-8 hover:bg-ink transition-colors"
          >
            Try again
          </button>
          <Link
            href="/cart"
            className="inline-block border border-ink/20 text-ink text-[11px] uppercase tracking-[0.22em] font-bold py-4 px-8 hover:bg-ink hover:text-paper transition-colors"
          >
            Back to basket
          </Link>
        </div>
      </div>
    );
  }

  // Default: redirecting spinner. The buyer should see this only briefly.
  return (
    <div className="mt-16 lg:mt-24 max-w-xl mx-auto text-center">
      <div className="mb-8 flex justify-center" aria-hidden="true">
        <div className="h-10 w-10 rounded-full border-2 border-ink/20 border-t-brand-red animate-spin" />
      </div>
      <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink/60 mb-4">
        One moment
      </p>
      <h1 className="font-display text-3xl sm:text-4xl tracking-tight leading-tight text-ink mb-6">
        Opening secure checkout
      </h1>
      <p className="text-base text-ink/70 leading-relaxed">
        We are handing you off to our payment provider. You will be redirected
        in a few seconds.
      </p>
    </div>
  );
}
