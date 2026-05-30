"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart/store";
import { formatPence } from "@/lib/products/format";
import { lineTotalPence } from "@/lib/cart/format";
import type { CartItem } from "@/lib/cart/types";

/**
 * Cart drawer. Right-edge slide-in panel. Always present in the DOM
 * so the slide-out animation plays — `translate-x-full` (closed) →
 * `translate-x-0` (open) with a Tailwind transition.
 *
 * Z-index layering (matches existing patterns):
 *   - Header sticky bar: z-40
 *   - Sticky CTA: z-40
 *   - Mobile menu: z-50
 *   - Cart backdrop: z-50
 *   - Cart panel: z-[60]
 *
 * Accessibility:
 *   - role="dialog" + aria-modal when open
 *   - Esc closes
 *   - Backdrop click closes
 *   - Focus moves to close button on open
 *   - Body scroll locks while open
 *
 * Hydration: pre-mount, count is 0 and items is []. We additionally
 * gate the open-state UI on `mounted` so the drawer cannot flash open
 * during hydration.
 */
export default function CartDrawer() {
  const { items, mounted, totalPence, isDrawerOpen, closeDrawer, removeItem } =
    useCart();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Body scroll lock + initial focus on open. Mirrors the mobile menu
  // pattern in _PublicHeader.tsx so behaviour feels consistent across
  // the two overlays.
  useEffect(() => {
    if (!isDrawerOpen) return;
    document.documentElement.style.overflow = "hidden";
    const t = setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => {
      clearTimeout(t);
      document.documentElement.style.overflow = "";
    };
  }, [isDrawerOpen]);

  // Esc to close — global keydown listener that only attaches while
  // the drawer is open.
  useEffect(() => {
    if (!isDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDrawerOpen, closeDrawer]);

  // Drawer can be "open" pre-mount only if something dispatched a UI
  // change before hydration finished, which we don't do. Belt-and-
  // braces guard anyway.
  const open = mounted && isDrawerOpen;

  return (
    <>
      {/* Backdrop — fades in/out. pointer-events disabled when closed
          so it doesn't intercept clicks on page content. */}
      <div
        className={`fixed inset-0 z-50 bg-ink/40 transition-opacity duration-300 ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Panel — slides from right edge. Always present in DOM. */}
      <aside
        role="dialog"
        aria-modal={open ? "true" : undefined}
        aria-label="Shopping basket"
        aria-hidden={!open}
        className={`fixed top-0 right-0 bottom-0 z-[60] w-full sm:w-[400px] bg-paper border-l border-rule flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="px-6 h-16 flex items-center justify-between border-b border-rule flex-shrink-0">
          <h2 className="text-[11px] uppercase tracking-[0.22em] font-bold text-ink">
            Your basket
            {mounted && items.length > 0 && (
              <span className="text-ink/50 ml-2">
                ({items.length} {items.length === 1 ? "item" : "items"})
              </span>
            )}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDrawer}
            aria-label="Close basket"
            className="p-2 -mr-2 hover:opacity-70 transition-opacity"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M6 6L18 18M6 18L18 6" strokeLinecap="square" />
            </svg>
          </button>
        </div>

        {/* Body — scrollable list of line items, or empty state */}
        <div className="flex-1 overflow-y-auto">
          {mounted && items.length === 0 && (
            <div className="px-6 py-16 flex flex-col items-center text-center">
              <p className="text-sm text-ink/60 mb-6">
                Your basket is empty.
              </p>
              <Link
                href="/products"
                onClick={closeDrawer}
                className="text-[11px] uppercase tracking-[0.22em] font-bold text-ink border-b-2 border-ink pb-1 hover:text-brand-red hover:border-brand-red transition-colors"
              >
                Browse products
              </Link>
            </div>
          )}

          {mounted && items.length > 0 && (
            <ul className="divide-y divide-rule">
              {items.map((item) => (
                <CartLineItem
                  key={item.productId}
                  item={item}
                  onRemove={() => removeItem(item.productId)}
                  onNavigate={closeDrawer}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Footer — totals + CTAs. Hidden when basket is empty. */}
        {mounted && items.length > 0 && (
          <div
            className="border-t border-rule px-6 pt-4 pb-6 flex-shrink-0"
            style={{
              paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
            }}
          >
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-[11px] uppercase tracking-[0.22em] font-bold text-ink">
                Subtotal
              </span>
              <span className="font-display text-2xl tabular-nums text-ink">
                {formatPence(totalPence)}
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-ink/50 mb-4">
              Delivery calculated at checkout
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href="/checkout"
                onClick={closeDrawer}
                className="w-full bg-brand-red text-paper text-[11px] uppercase tracking-[0.22em] font-bold py-4 text-center hover:bg-ink transition-colors"
              >
                Checkout
              </Link>
              <Link
                href="/cart"
                onClick={closeDrawer}
                className="w-full border border-ink text-ink text-[11px] uppercase tracking-[0.22em] font-bold py-4 text-center hover:bg-ink hover:text-paper transition-colors"
              >
                View basket
              </Link>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

// ============================================================
// CartLineItem — internal sub-component, one per item in cart
// ============================================================
// Renders a single row: 80px square hero thumb, name + brand, condition
// pill, line total, remove (X) button. Used items show "Qty 1" plain
// text; new items show qty controls in patch 4 (omitted here so this
// patch ships standalone).
function CartLineItem({
  item,
  onRemove,
  onNavigate,
}: {
  item: CartItem;
  onRemove: () => void;
  onNavigate: () => void;
}) {
  const conditionLabel =
    item.condition === "used"
      ? item.grade
        ? `USED · ${item.grade}`
        : "USED"
      : "NEW";

  return (
    <li className="px-6 py-4 flex gap-4">
      {/* Thumb — 80px square, links to product page. Uses next/image
          with fill + sizes="80px" so Next's optimiser handles the
          resize. Falls back to neutral square if no hero. */}
      <Link
        href={`/products/${item.slug}`}
        onClick={onNavigate}
        className="relative h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 bg-rule/40 overflow-hidden"
        aria-label={`View ${item.name}`}
      >
        {item.heroUrl ? (
          <Image
            src={item.heroUrl}
            alt={item.name}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[9px] uppercase tracking-[0.18em] text-ink/30 font-bold">
            No image
          </span>
        )}
      </Link>

      {/* Body */}
      <div className="flex-1 min-w-0 flex flex-col">
        <Link
          href={`/products/${item.slug}`}
          onClick={onNavigate}
          className="block group"
        >
          {item.brand && (
            <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink/60 mb-0.5">
              {item.brand}
            </p>
          )}
          <h3 className="text-sm font-bold text-ink leading-snug line-clamp-2 group-hover:text-brand-red transition-colors">
            {item.name}
          </h3>
        </Link>
        <p className="text-[10px] uppercase tracking-[0.22em] text-ink/50 mt-1">
          {conditionLabel}
          {item.condition === "used" ? " · Qty 1" : ` · Qty ${item.qty}`}
        </p>
        <div className="flex items-baseline justify-between mt-2">
          <span className="font-display text-base tabular-nums text-ink">
            {formatPence(lineTotalPence(item))}
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
    </li>
  );
}
