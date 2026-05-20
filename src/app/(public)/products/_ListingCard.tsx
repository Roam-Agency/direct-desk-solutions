/**
 * Listing card.
 *
 * The workhorse of the buyer-facing browse experience. One component
 * renders both new and used products with a black corner-tab badge in
 * both cases (NEW for new items, USED · A/B/C for used items — design
 * decision Session 3).
 *
 * Used on:
 *   - /products/new
 *   - /products/used
 *   - (future) category landing pages
 *   - (future) related-products row on the detail page
 *
 * Reads from the ProductCard projection (product row + hero image
 * url/alt) returned by listLiveProducts. No additional queries per
 * card.
 */

import Link from "next/link";
import Image from "next/image";
import { formatPence } from "@/lib/products/format";
import type { ProductCard as ProductCardData } from "@/lib/products/fetch";

function calcSavePercent(
  was: number | null,
  current: number
): number | null {
  if (!was || was <= current) return null;
  return Math.round(((was - current) / was) * 100);
}

export default function ListingCard({ product }: { product: ProductCardData }) {
  const isUsed = product.condition === "used";
  const badgeText = isUsed
    ? product.condition_grade
      ? `USED · ${product.condition_grade}`
      : "USED"
    : "NEW";

  const savePercent = calcSavePercent(
    product.was_price_pence,
    product.price_pence
  );

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 focus:ring-offset-paper"
    >
      <article className="relative">
        {/* Image */}
        <div className="relative aspect-square bg-rule/40 overflow-hidden">
          {product.hero_image_url ? (
            <Image
              src={product.hero_image_url}
              alt={product.hero_image_alt ?? product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs uppercase tracking-[0.22em] text-ink/30 font-bold">
                No image
              </span>
            </div>
          )}

          {/* Corner badge — black tab top-left */}
          <div className="absolute top-0 left-0 bg-ink text-paper px-2.5 py-1.5">
            <span className="text-[10px] uppercase tracking-[0.22em] font-black">
              {badgeText}
            </span>
          </div>

          {/* Save chip — bottom-right, only on used items with a was-price */}
          {savePercent !== null && (
            <div className="absolute bottom-2 right-2 bg-brand-red text-paper px-2 py-1">
              <span className="text-[10px] uppercase tracking-[0.18em] font-black">
                Save {savePercent}%
              </span>
            </div>
          )}
        </div>

        {/* Text */}
        <div className="pt-3">
          {product.brand && (
            <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink/60 mb-1">
              {product.brand}
            </p>
          )}
          <h3 className="text-sm font-bold text-ink leading-snug mb-2 line-clamp-2">
            {product.name}
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-black text-ink">
              {formatPence(product.price_pence)}
            </span>
            {product.was_price_pence &&
              product.was_price_pence > product.price_pence && (
                <span className="text-xs text-ink/40 line-through">
                  {formatPence(product.was_price_pence)}
                </span>
              )}
          </div>
        </div>
      </article>
    </Link>
  );
}
