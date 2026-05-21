import type { Metadata } from "next";
import Breadcrumb from "../_Breadcrumb";
import CheckoutRedirect from "./_CheckoutRedirect";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your Direct Desk Solutions order.",
  robots: {
    index: false,
    follow: true,
  },
};

/**
 * Checkout page.
 *
 * A thin server-component shell that renders the breadcrumb and
 * delegates the actual work to <CheckoutRedirect />. The redirector
 * is a client component because it needs to read the localStorage
 * cart and trigger a window.location navigation off-origin to Stripe.
 *
 * Buyers should not linger here. The expected path is /cart ->
 * /checkout (this page) -> checkout.stripe.com, with the middle
 * frame visible only as a spinner for a fraction of a second.
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
      <CheckoutRedirect />
    </div>
  );
}
