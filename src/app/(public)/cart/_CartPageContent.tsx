"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart/store";
import { formatPence } from "@/lib/products/format";
import type { CartItem } from "@/lib/cart/types";
import { refreshCartItems } from "./_cart-actions";

/**
 * Per-item refresh state, keyed by productId.
 *
 * status:
 *   undefined    Refresh hasn't returned yet for this item.
 *   "ok"         Live, in stock, price unchanged from snapshot.
 *   "price-up"   Live, in stock, price went up since add.
 *   "price-down" Live, in stock, price went down since add.
 *   "clamped"    Live, but stock dropped below cart qty (new items
 *                only). qty has been auto-corrected in the store.
 *   "gone"       Row missing or archived. Line excluded from total.
 */
type RefreshStatus =
  | "ok"
  | "price-up"
  | "price-down"
  | "clamped"
  | "gone";

type RefreshState = Record<
  string,
  {
    status: RefreshStatus;
    livePricePence: number;
    liveStockQuantity: number;
  }
>;

export default function CartPageContent() {
  const { items, mounted, removeItem, setQty } = useCart();
  const [refresh, setRefresh] = useState<RefreshState>({});

  // Refresh on mount once we have hydrated cart items to send.
  // If items change later (remove/add), we don't re-refresh — the drift
  // info we have is good enough until the buyer reloads.
  useEffect(() => {
    if (!mounted || items.length === 0) return;

    // We don't seed the refresh map with "loading" entries because
    // calling setState eagerly inside an effect violates React 19's
    // react-hooks/set-state-in-effect rule. Instead, absence from the
    // map IS the loading state — see refresh === undefined checks
    // in the render below. The .then() callback populates the map in
    // one batched setState.
    const productIds = items.map((i) => i.productId);

    refreshCartItems(productIds).then((result) => {
      if (!result.ok) {
        // Network or server failure. Treat all items as ok-with-snapshot;
        // no drift detected. Better than blocking checkout.
        const fallback: RefreshState = {};
        for (const item of items) {
          fallback[item.productId] = {
            status: "ok",
            livePricePence: item.pricePence,
            liveStockQuantity: item.stockAtAdd,
          };
        }
        setRefresh(fallback);
        return;
      }

      const next: RefreshState = {};
      for (const r of result.data.items) {
        const cartItem = items.find((i) => i.productId === r.productId);
        if (!cartItem) continue;

        if (!r.found || r.stockQuantity <= 0) {
          next[r.productId] = {
            status: "gone",
            livePricePence: r.pricePence,
            liveStockQuantity: r.stockQuantity,
          };
          continue;
        }

        // Stock-clamp for new items only. Used items are one-of-one
        // and would be gone above if stock dropped to 0.
        if (
          cartItem.condition === "new" &&
          r.stockQuantity < cartItem.qty
        ) {
          setQty(cartItem.productId, r.stockQuantity);
          next[r.productId] = {
            status: "clamped",
            livePricePence: r.pricePence,
            liveStockQuantity: r.stockQuantity,
          };
          continue;
        }

        if (r.pricePence > cartItem.pricePence) {
          next[r.productId] = {
            status: "price-up",
            livePricePence: r.pricePence,
            liveStockQuantity: r.stockQuantity,
          };
        } else if (r.pricePence < cartItem.pricePence) {
          next[r.productId] = {
            status: "price-down",
            livePricePence: r.pricePence,
            liveStockQuantity: r.stockQuantity,
          };
        } else {
          next[r.productId] = {
            status: "ok",
            livePricePence: r.pricePence,
            liveStockQuantity: r.stockQuantity,
          };
        }
      }
      setRefresh(next);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Live total uses the live price for any item that has refreshed, and
  // excludes "gone" items. Pre-refresh items fall back to snapshot.
  const livePence = items.reduce((sum, item) => {
    const r = refresh[item.productId];
    if (r?.status === "gone") return sum;
    const price = r?.livePricePence ?? item.pricePence;
    return sum + price * item.qty;
  }, 0);

  // Pre-mount: render an empty-state-shaped skeleton so the layout
  // doesn't reflow on hydration.
  if (!mounted) {
    return (
      <div className="py-16 text-center text-ink/40 text-sm uppercase tracking-[0.22em] font-bold">
        Loading basket...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center text-center">
        <p className="text-base text-ink/60 mb-8">
          Your basket is empty.
        </p>
        <Link
          href="/products"
          className="inline-block text-[11px] uppercase tracking-[0.22em] font-bold text-ink border-b-2 border-ink pb-1 hover:text-brand-red hover:border-brand-red transition-colors"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-12 lg:gap-10">
      {/* Line items column */}
      <div className="lg:col-span-8">
        <ul className="divide-y divide-rule border-y border-rule">
          {items.map((item) => (
            <CartLine
              key={item.productId}
              item={item}
              refresh={refresh[item.productId]}
              onRemove={() => removeItem(item.productId)}
              onQtyChange={(q) => setQty(item.productId, q)}
            />
          ))}
        </ul>
      </div>

      {/* Order summary */}
      <div className="lg:col-span-4 mt-10 lg:mt-0">
        <div className="border border-rule p-6 sticky top-20">
          <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-ink mb-4">
            Order summary
          </p>
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-sm text-ink/70">Subtotal</span>
            <span className="font-display text-2xl tabular-nums text-ink">
              {formatPence(livePence)}
            </span>
          </div>
          <div className="flex items-baseline justify-between mb-6">
            <span className="text-sm text-ink/70">Delivery</span>
            <span className="text-xs uppercase tracking-[0.18em] text-ink/50 font-bold">
              At checkout
            </span>
          </div>
          <div className="border-t border-rule pt-4 mb-6 flex items-baseline justify-between">
            <span className="text-[11px] uppercase tracking-[0.22em] font-bold text-ink">
              Total
            </span>
            <span className="font-display text-2xl tabular-nums text-ink">
              {formatPence(livePence)}
            </span>
          </div>
          <Link
            href="/checkout"
            className="block w-full bg-brand-red text-paper text-[11px] uppercase tracking-[0.22em] font-bold py-4 text-center hover:bg-ink transition-colors"
          >
            Checkout
          </Link>
          <Link
            href="/products"
            className="block mt-3 text-center text-[11px] uppercase tracking-[0.18em] font-bold text-ink/70 hover:text-brand-red transition-colors underline-offset-4 hover:underline"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CartLine — one item in the cart-page list
// ============================================================
// Larger than the drawer line item. Hero thumb 120px, qty stepper
// for new items, condition badge, refresh-status notices.
function CartLine({
  item,
  refresh,
  onRemove,
  onQtyChange,
}: {
  item: CartItem;
  refresh: RefreshState[string] | undefined;
  onRemove: () => void;
  onQtyChange: (qty: number) => void;
}) {
  const conditionLabel =
    item.condition === "used"
      ? item.grade
        ? `USED · ${item.grade}`
        : "USED"
      : "NEW";

  const isGone = refresh?.status === "gone";
  const livePrice = refresh?.livePricePence ?? item.pricePence;
  const lineTotal = isGone ? 0 : livePrice * item.qty;

  // For new items only, qty controls are interactive. Used items pin
  // at 1 and show plain "Qty 1".
  const showQtyStepper = item.condition === "new" && !isGone;
  const maxQty = refresh?.liveStockQuantity ?? item.stockAtAdd;

  return (
    <li className="px-0 py-6 flex gap-4 sm:gap-6">
      {/* Thumb — 120px square */}
      <Link
        href={`/products/${item.slug}`}
        className="relative w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 bg-rule/40 overflow-hidden"
        aria-label={`View ${item.name}`}
      >
        {item.heroUrl ? (
          <Image
            src={item.heroUrl}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 96px, 128px"
            className={isGone ? "object-cover opacity-40" : "object-cover"}
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[9px] uppercase tracking-[0.18em] text-ink/30 font-bold">
            No image
          </span>
        )}
      </Link>

      {/* Body */}
      <div className="flex-1 min-w-0 flex flex-col">
        <Link href={`/products/${item.slug}`} className="block group">
          {item.brand && (
            <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink/60 mb-0.5">
              {item.brand}
            </p>
          )}
          <h3 className="text-base font-bold text-ink leading-snug group-hover:text-brand-red transition-colors">
            {item.name}
          </h3>
        </Link>
        <p className="text-[10px] uppercase tracking-[0.22em] text-ink/50 mt-1">
          {conditionLabel}
        </p>

        {/* Drift notices */}
        {refresh?.status === "price-up" && (
          <p className="text-[11px] text-brand-red mt-2 font-bold">
            Price updated: was {formatPence(item.pricePence)}, now {formatPence(livePrice)}
          </p>
        )}
        {refresh?.status === "price-down" && (
          <p className="text-[11px] text-ink/70 mt-2">
            Price dropped: was {formatPence(item.pricePence)}, now {formatPence(livePrice)}
          </p>
        )}
        {refresh?.status === "clamped" && (
          <p className="text-[11px] text-brand-red mt-2 font-bold">
            Only {refresh.liveStockQuantity} available — basket adjusted
          </p>
        )}
        {refresh?.status === "gone" && (
          <p className="text-[11px] text-brand-red mt-2 font-bold uppercase tracking-[0.18em]">
            No longer available
          </p>
        )}

        {/* Bottom row: qty + line total + remove */}
        <div className="flex items-center justify-between mt-3">
          {showQtyStepper ? (
            <div className="flex items-center border border-ink/20">
              <button
                type="button"
                onClick={() => onQtyChange(item.qty - 1)}
                disabled={item.qty <= 1}
                aria-label="Decrease quantity"
                className="px-3 py-1.5 text-sm hover:bg-ink hover:text-paper transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink"
              >
                −
              </button>
              <span className="px-4 py-1.5 text-sm tabular-nums border-x border-ink/20 min-w-[3ch] text-center">
                {item.qty}
              </span>
              <button
                type="button"
                onClick={() => onQtyChange(item.qty + 1)}
                disabled={item.qty >= maxQty}
                aria-label="Increase quantity"
                className="px-3 py-1.5 text-sm hover:bg-ink hover:text-paper transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink"
              >
                +
              </button>
            </div>
          ) : (
            <span className="text-[11px] uppercase tracking-[0.18em] text-ink/50 font-bold">
              Qty {item.qty}
            </span>
          )}
          <div className="flex items-baseline gap-4">
            <span className="font-display text-lg tabular-nums text-ink">
              {formatPence(lineTotal)}
            </span>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${item.name} from basket`}
              className="text-[10px] uppercase tracking-[0.18em] font-bold text-ink/50 hover:text-brand-red transition-colors underline-offset-4 hover:underline"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
