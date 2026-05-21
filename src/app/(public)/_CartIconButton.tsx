"use client";

import { useCart } from "@/lib/cart/store";

/**
 * Basket icon button rendered in the public header.
 *
 * Two responsibilities:
 *   1. Visual indicator of cart contents — shows a small red count
 *      badge top-right when items are in the cart.
 *   2. Click target — opens the cart drawer via context.
 *
 * Hydration safety: `count` comes from the cart store, which keeps
 * count=0 until the localStorage HYDRATE effect runs. Server render
 * and first client render both show no badge, then the badge appears
 * after hydration. This matches the pattern used elsewhere in the
 * codebase to dodge React 19's SSR/CSR mismatch warnings.
 */
function BasketIcon() {
  // Open-top basket with handle. Matches the SearchIcon's stroke
  // weight + linecap so the two icons read as a set.
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M3 7L21 7L19 19L5 19L3 7Z" strokeLinejoin="miter" />
      <path d="M8 7C8 4.5 9.5 3 12 3C14.5 3 16 4.5 16 7" strokeLinecap="square" />
    </svg>
  );
}

type Props = {
  // Tone changes between the desktop nav (hover:text-brand-red) and
  // the mobile cluster (hover:opacity-70 — matches the hamburger).
  tone?: "desktop" | "mobile";
};

export default function CartIconButton({ tone = "desktop" }: Props) {
  const { count, openDrawer } = useCart();

  const hoverClass =
    tone === "desktop"
      ? "hover:text-brand-red transition-colors"
      : "hover:opacity-70 transition-opacity";

  const hasItems = count > 0;
  const countLabel =
    count > 9 ? "9+" : count.toString();

  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={
        hasItems
          ? `Open basket, ${count} item${count === 1 ? "" : "s"}`
          : "Open basket"
      }
      className={`relative text-ink ${hoverClass} p-2 -mr-2`}
    >
      <BasketIcon />
      {hasItems && (
        <span
          className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 bg-brand-red text-paper text-[10px] font-black leading-none flex items-center justify-center tabular-nums"
          aria-hidden="true"
        >
          {countLabel}
        </span>
      )}
    </button>
  );
}
