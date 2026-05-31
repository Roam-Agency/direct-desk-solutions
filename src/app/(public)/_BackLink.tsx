"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Visible "back" control for public pages.
 *
 * The breadcrumb alone is a small, low-affordance target on mobile, so
 * this renders an obvious arrow + label tap target. Behaviour:
 *   - If there's in-app history to go back to, use router.back() so the
 *     user returns to wherever they came from (a listing, search, etc.)
 *     with scroll position preserved.
 *   - Otherwise (deep link / fresh tab, where history.length is 1) fall
 *     back to `fallbackHref` so the button always goes somewhere sensible.
 *
 * Rendered as a real <a>/<button> with a 44px-tall hit area for touch.
 */
export default function BackLink({
  fallbackHref,
  label = "Back",
}: {
  fallbackHref: string;
  label?: string;
}) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    // Only hijack a plain left-click — let modifier/middle clicks open
    // the fallback href in a new tab as usual.
    if (
      e.defaultPrevented ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0
    ) {
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
    // else: allow the <a href={fallbackHref}> default navigation.
  }

  return (
    <Link
      href={fallbackHref}
      onClick={handleClick}
      className="group inline-flex items-center gap-2 py-2 text-xs font-bold uppercase tracking-[0.18em] text-ink/60 transition-colors hover:text-ink"
    >
      <span
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-full border border-rule text-ink/70 transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-paper"
      >
        ←
      </span>
      {label}
    </Link>
  );
}
