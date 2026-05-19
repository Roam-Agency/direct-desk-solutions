import { formatPence } from "@/lib/products/format";

/**
 * Price block — the biggest typographic moment on the page.
 *
 *   £645        ← display font, massive
 *   £1,450  SAVE £805  ← strikethrough + red chip on a single row
 *
 * Both the strikethrough and chip are rendered only when was_price_pence
 * exists. New items typically have no RRP comparison, so the block
 * gracefully collapses to a single line.
 *
 * Money in pence per the codebase convention. formatPence handles
 * locale, currency symbol, and the dash fallback.
 */

type PriceBlockProps = {
  price_pence: number;
  was_price_pence: number | null;
};

export default function PriceBlock({
  price_pence,
  was_price_pence,
}: PriceBlockProps) {
  const showSavings =
    was_price_pence !== null && was_price_pence > price_pence;
  const savings_pence = showSavings
    ? was_price_pence - price_pence
    : 0;

  return (
    <div className="space-y-1">
      <p className="font-display text-5xl sm:text-6xl tracking-tight leading-none text-ink">
        {formatPence(price_pence)}
      </p>
      {showSavings && (
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <p className="text-base text-ink/50 line-through">
            {formatPence(was_price_pence)}
          </p>
          <p className="text-[11px] tracking-[0.22em] uppercase font-bold text-white bg-brand-red px-2.5 py-1">
            Save {formatPence(savings_pence)}
          </p>
        </div>
      )}
    </div>
  );
}
