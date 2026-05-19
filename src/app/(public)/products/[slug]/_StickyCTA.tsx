"use client";

import { formatPence } from "@/lib/products/format";

/**
 * Sticky CTA bar anchored to the bottom of the viewport on the product
 * detail page.
 *
 * Two halves:
 *   1. "Add to basket · £NN" — primary CTA, brand-red, full price visible.
 *      v1 is intentionally a disabled visual stub. Phase 4 will wire it
 *      up to a real basket. We deliberately do NOT show a "Coming soon"
 *      toast on click — a button that looks live but does nothing teaches
 *      the buyer the wrong thing. Better to dim it slightly so the design
 *      reads, but make non-functionality obvious via cursor + aria.
 *   2. "View condition report ↓" — anchor link that scrolls to
 *      #condition-report. Only shown when hasPublishedReport is true
 *      (used items with a published report). Hidden otherwise, so the
 *      CTA half takes the full width.
 *
 * Safe-area padding on the inner bar handles iOS notch / home indicator.
 * Top hairline rule separates from page content above.
 */

type Props = {
  pricePence: number;
  hasPublishedReport: boolean;
};

export default function StickyCTA({ pricePence, hasPublishedReport }: Props) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-rule bg-paper/95 backdrop-blur-sm"
      style={{
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 pt-3">
        <div className="flex items-stretch gap-3">
          {/* Primary CTA — disabled stub for v1 */}
          <button
            type="button"
            disabled
            aria-disabled="true"
            aria-label={`Add to basket for ${formatPence(pricePence)} — basket coming soon`}
            className="flex-1 flex items-center justify-center gap-3 bg-brand-red/85 text-paper py-4 px-5 cursor-not-allowed select-none"
          >
            <span className="text-[11px] uppercase tracking-[0.22em] font-bold">
              Add to basket
            </span>
            <span className="text-ink/30" aria-hidden="true">
              ·
            </span>
            <span className="font-display text-base tabular-nums">
              {formatPence(pricePence)}
            </span>
          </button>

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

        {/* Mobile-only "View condition report" link — placed below the CTA
            on narrow screens so the basket button stays full-width and the
            anchor link still surfaces. */}
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
