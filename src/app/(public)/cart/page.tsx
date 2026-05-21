import type { Metadata } from "next";
import Breadcrumb from "../_Breadcrumb";
import CartPageContent from "./_CartPageContent";

export const metadata: Metadata = {
  title: "Your basket",
  description:
    "Review the items in your Direct Desk Solutions basket before checkout.",
  // Buyer-side carts are private; explicitly opt out of indexing.
  robots: {
    index: false,
    follow: true,
  },
};

export default function CartPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 pt-6 pb-16">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Your basket" },
        ]}
      />
      <h1 className="font-display text-3xl sm:text-4xl tracking-tight leading-tight text-ink mt-6 mb-8">
        Your basket
      </h1>
      <CartPageContent />
    </div>
  );
}
