"use client";

import { useLinkStatus } from "next/link";

/**
 * Inline "navigation in progress" spinner.
 *
 * Must be rendered as a descendant of a <Link>; useLinkStatus reports that
 * link's pending state. We render it inside the Products status/condition
 * tabs and the pager so a click gives immediate feedback even though the
 * admin layout is cookie-bound and therefore blocks navigation until the
 * server finishes rendering (see Next's loading.js / instant-navigation
 * docs — without Cache Components a loading.js fallback can't cover a
 * runtime/cookie-reading layout, so the link-level hint is what surfaces
 * "it's working, give it a moment").
 *
 * The parent <Link> sets prefetch={false}: a prefetched route skips the
 * pending phase entirely, and prefetching these heavy, dynamic list pages
 * would be wasteful anyway.
 *
 * Space is reserved with a fixed-size box and toggled via opacity to avoid
 * layout shift, per the useLinkStatus guidance.
 */
export function LoadingHint() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden={!pending}
      aria-label={pending ? "Loading" : undefined}
      className={
        "ml-1.5 inline-block h-3 w-3 align-middle transition-opacity " +
        (pending ? "opacity-100" : "opacity-0")
      }
    >
      <span className="block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
    </span>
  );
}
