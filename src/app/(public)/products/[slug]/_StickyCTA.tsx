"use client";

import { formatPence } from "@/lib/products/format";
import { useCart } from "@/lib/cart/store";
import type { AddItemInput } from "@/lib/cart/store";

/**
 * Sticky CTA bar anchored to the bottom of the viewport on the product
 * detail page.
 *
 * Two halves:
 *   1. Primary CTA — brand-red "Add to basket · £NN" button.
 *      Live: dispatches addItem then opens the drawer. Behaviour adapts
 *      to product state — see the BUTTON STATE MATRIX below.
 *   2. "Condition report ↓" — anchor link that scrolls to
 *      #condition-report. Only shown when hasPublishedReport is true
 *      (used items with a published report). Hidden otherwise, so the
 *      CTA takes the full width.
 *
 * BUTTON STATE MATRIX
 * ────────────────────────────────────────────────
 *   Pre-mount (cart hydrating):   Visually-live look, click no-ops
 *                                 via aria-disabled. Prevents clicks
 *                                 during the brief window before
 *                                 localStorage has been read.
 *   Out of stock (qty <= 0):      Black bg, "Out of stock", disabled.
 *                                 Used items typically have qty 1
 *                                 until sold, so this surfaces only
 *                                 once the warehouse marks zero.
 *   Used + already in basket:     Brand-red, "In basket ✓", live.
 *                                 Click opens the drawer (the reducer
 *                                 would no-op on re-add anyway, but
 *                                 the label honesty matters).
 *   Default:                      Brand-red, "Add to basket · £NN",
 *                                 live. Click dispatches addItem then
 *                                 opens the drawer.
 *
 * Safe-area padding on the inner bar handles iOS notch / home indicator.
 * Top hairline rule separates from page content above.
 */

type Variant = "mobile-sticky" | "desktop-inline";

type Props = {
  // The cart payload — everything the store needs to remember about
  // this product. The component constructs the addItem call from these
  // fields without any further fetches.
  productId: string;
  slug: string;
  name: string;
  brand: string | null;
  condition: "new" | "used";
  grade: "A" | "B" | "C" | null;
  heroUrl: string | null;
  pricePence: number;
  stockQuantity: number;

  hasPublishedReport: boolean;
  variant?: Variant;
};

type ButtonState =
  | "loading"        // cart not yet mounted; visually-live, click is no-op
  | "out-of-stock"   // stockQuantity <= 0
  | "in-basket"      // used item already in cart
  | "live";          // default — dispatch + open drawer

export default function StickyCTA(props: Props) {
  const {
    productId,
    slug,
    name,
    brand,
    condition,
    grade,
    heroUrl,
    pricePence,
    stockQuantity,
    hasPublishedReport,
    variant = "mobile-sticky",
  } = props;

  const { mounted, items, addItem, openDrawer } = useCart();

  // Derive button state. Order of checks matters: out-of-stock beats
  // in-basket (you can't add it anyway), loading beats everything (we
  // don't yet know what's in the cart).
  const alreadyInCart =
    mounted && items.some((i) => i.productId === productId);

  const state: ButtonState =
    !mounted
      ? "loading"
      : stockQuantity <= 0
        ? "out-of-stock"
        : condition === "used" && alreadyInCart
          ? "in-basket"
          : "live";

  const handleClick = () => {
    if (state === "loading" || state === "out-of-stock") return;

    if (state === "live") {
      const payload: AddItemInput = {
        productId,
        slug,
        name,
        brand,
        condition,
        grade,
        heroUrl,
        pricePence,
        stockAtAdd: stockQuantity,
      };
      addItem(payload);
    }

    // Whether we just added or it was already there, open the drawer.
    // This makes the click feel responsive even on "In basket" — the
    // buyer sees their basket confirmation.
    openDrawer();
  };

  // Visual + textual presentation derived from state. Kept separate
  // from the click handler so the markup below stays declarative.
  const isDisabled = state === "loading" || state === "out-of-stock";
  const isBlack = state === "out-of-stock";

  const buttonBg = isBlack
    ? "bg-ink text-paper cursor-not-allowed"
    : isDisabled
      ? "bg-brand-red/85 text-paper cursor-wait"
      : "bg-brand-red text-paper hover:bg-ink transition-colors";

  // Label and price visibility per state.
  const showPrice = state === "loading" || state === "live";
  const label =
    state === "out-of-stock"
      ? "Out of stock"
      : state === "in-basket"
        ? "In basket ✓"
        : "Add to basket";

  const ariaLabel =
    state === "out-of-stock"
      ? `${name} is out of stock`
      : state === "in-basket"
        ? `View basket — ${name} already added`
        : `Add ${name} to basket for ${formatPence(pricePence)}`;

  // Shared markup for the button itself. Used in both variants.
  const ButtonInner = (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      aria-disabled={isDisabled ? "true" : undefined}
      aria-label={ariaLabel}
      className={`flex-1 flex items-center justify-center gap-3 py-4 px-5 select-none ${buttonBg}`}
    >
      <span className="text-[11px] uppercase tracking-[0.22em] font-bold">
        {label}
      </span>
      {showPrice && (
        <>
          <span className="text-paper/40" aria-hidden="true">
            ·
          </span>
          <span className="font-display text-base tabular-nums">
            {formatPence(pricePence)}
          </span>
        </>
      )}
    </button>
  );

  // Desktop-inline variant: renders the primary CTA in-flow inside the
  // product info column. No fixed positioning, no top hairline, no
  // backdrop blur. The condition report link is omitted because the
  // report itself is visible further down the same page.
  if (variant === "desktop-inline") {
    return (
      <div className="w-full flex">
        {ButtonInner}
      </div>
    );
  }

  // Mobile-sticky variant (default): fixed bottom bar with safe-area
  // padding and an optional secondary anchor link to the condition
  // report. Hidden at lg+ so it doesn't overlap the desktop inline CTA.
  return (
    <div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-rule bg-paper/95 backdrop-blur-sm"
      style={{
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 pt-3">
        <div className="flex items-stretch gap-3">
          {ButtonInner}

          {/* Secondary anchor — only when there's a published report to scroll to */}
          {hasPublishedReport && (
            <a
              href="#condition-report"
              className="hidden sm:flex items-center justify-center gap-2 border border-ink/20 bg-paper text-ink py-4 px-5 hover:bg-ink hover:text-paper transition-colors"
            >
              <span className="text-[11px] uppercase tracking-[0.22em] font-bold">
                Condition report
              </span>
              <span aria-hidden="true" className="text-base leading-none">
                ↓
              </span>
            </a>
          )}
        </div>

        {/* Mobile-only "View condition report" link — placed below the
            CTA on narrow screens so the basket button stays full-width
            and the anchor link still surfaces. */}
        {hasPublishedReport && (
          <a
            href="#condition-report"
            className="sm:hidden mt-2 mb-1 flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-[0.18em] font-bold text-ink/70 underline-offset-4 hover:underline"
          >
            View condition report
            <span aria-hidden="true">↓</span>
          </a>
        )}
      </div>
    </div>
  );
}
