import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "../_Breadcrumb";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your Direct Desk Solutions order.",
  robots: {
    index: false,
    follow: true,
  },
};

/**
 * Checkout placeholder.
 *
 * The route exists so the drawer and /cart Checkout CTAs route
 * somewhere honest rather than 404. Real Stripe Checkout integration
 * lands in Session 10 and will replace the body of this file. The
 * URL stays stable.
 *
 * Deliberately no fake form, no "Coming soon" banner overlaid on a
 * working-looking surface. A clear message about what is and isn't
 * yet available is more useful to the buyer than an aspirational UI.
 */
export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 pt-6 pb-24">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Your basket", href: "/cart" },
          { label: "Checkout" },
        ]}
      />
      <div className="mt-16 lg:mt-24 max-w-xl mx-auto text-center">
        <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-brand-red mb-4">
          Coming soon
        </p>
        <h1 className="font-display text-3xl sm:text-4xl tracking-tight leading-tight text-ink mb-6">
          Checkout opening soon
        </h1>
        <p className="text-base text-ink/70 leading-relaxed mb-10">
          We&rsquo;re finishing the secure card-payment integration. In the
          meantime, email us with your basket and we&rsquo;ll get an invoice
          and delivery slot to you within the hour.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <a
            href="mailto:info@directdesksolutions.com?subject=Order%20enquiry"
            className="inline-block bg-brand-red text-paper text-[11px] uppercase tracking-[0.22em] font-bold py-4 px-8 hover:bg-ink transition-colors"
          >
            Email us
          </a>
          <Link
            href="/cart"
            className="inline-block border border-ink/20 text-ink text-[11px] uppercase tracking-[0.22em] font-bold py-4 px-8 hover:bg-ink hover:text-paper transition-colors"
          >
            Back to basket
          </Link>
        </div>
      </div>
    </div>
  );
}
