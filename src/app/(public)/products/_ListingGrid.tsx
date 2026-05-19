/**
 * Listing grid.
 *
 * Lays out ListingCards in a responsive grid:
 *   - 2 cols mobile (the buyer is on a phone, two cards per row is
 *     the right density)
 *   - 3 cols sm+ (tablet portrait)
 *   - 4 cols lg+ (desktop)
 *
 * Handles the empty state with a neutral message. Doesn't fetch — pass
 * it the products from a server component.
 */

import ListingCard from "./_ListingCard";
import type { ProductCard as ProductCardData } from "@/lib/products/fetch";

export default function ListingGrid({
  products,
  emptyMessage,
}: {
  products: ProductCardData[];
  emptyMessage?: string;
}) {
  if (products.length === 0) {
    return (
      <div className="border border-rule py-16 px-6 text-center">
        <p className="text-xs uppercase tracking-[0.22em] font-bold text-ink/40">
          {emptyMessage ?? "No products found"}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10">
      {products.map((product) => (
        <ListingCard key={product.id} product={product} />
      ))}
    </div>
  );
}
