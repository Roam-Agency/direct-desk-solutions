import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "../../_Breadcrumb";

export const metadata: Metadata = {
  title: "Payment cancelled",
  description: "Your Direct Desk Solutions payment was cancelled.",
  robots: {
    index: false,
    follow: true,
  },
};

/**
 * /checkout/cancel
 *
 * Where Stripe sends buyers who close the hosted Checkout window or
 * click its cancel link. Their cart is still in localStorage; their
 * stock_reservations rows are still active and will expire on the
 * 15-minute TTL. Nothing to clean up server-side.
 *
 * Tone: friendly, not apologetic. Most cancellations are deliberate
 * (changed mind, sanity-check) not failures. No "something went
 * wrong" framing.
 */
export default function CheckoutCancelPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 pt-6 pb-24">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Your basket", href: "/cart" },
          { label: "Cancelled" },
        ]}
      />
      <div className="mt-16 lg:mt-24 max-w-xl mx-auto text-center">
        <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-brand-red mb-4">
          Payment cancelled
        </p>
        <h1 className="font-display text-3xl sm:text-4xl tracking-tight leading-tight text-ink mb-6">
          No charge made
        </h1>
        <p className="text-base text-ink/70 leading-relaxed mb-10">
          Your card wasn&rsquo;t charged and your basket is still saved. Come
          back to it whenever you&rsquo;re ready.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <Link
            href="/cart"
            className="inline-block bg-brand-red text-paper text-[11px] uppercase tracking-[0.22em] font-bold py-4 px-8 hover:bg-ink transition-colors"
          >
            Back to basket
          </Link>
          <Link
            href="/products"
            className="inline-block border border-ink/20 text-ink text-[11px] uppercase tracking-[0.22em] font-bold py-4 px-8 hover:bg-ink hover:text-paper transition-colors"
          >
            Continue browsing
          </Link>
        </div>
      </div>
    </div>
  );
}
