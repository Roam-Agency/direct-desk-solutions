/**
 * Stock state badge.
 *
 * Three states:
 *   - stock_quantity === 0           → "Out of Stock" (grey)
 *   - stock_quantity <= threshold    → "Low Stock — N left" (red)
 *   - otherwise                      → "In Stock" (black)
 *
 * The threshold falls back to 3 when low_stock_alert is null, so we
 * have a sensible default for new products that haven't had the
 * field configured.
 *
 * Visual treatment is intentionally restrained — this is a status
 * indicator, not a CTA. The red on "low stock" carries urgency.
 */

type StockBadgeProps = {
  stock_quantity: number;
  low_stock_alert: number | null;
};

const DEFAULT_LOW_STOCK_THRESHOLD = 3;

export default function StockBadge({
  stock_quantity,
  low_stock_alert,
}: StockBadgeProps) {
  const threshold = low_stock_alert ?? DEFAULT_LOW_STOCK_THRESHOLD;

  if (stock_quantity === 0) {
    return (
      <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] font-bold text-ink/50">
        <span
          aria-hidden="true"
          className="inline-block w-1.5 h-1.5 rounded-full bg-ink/40"
        />
        Out of Stock
      </p>
    );
  }

  if (stock_quantity <= threshold) {
    return (
      <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] font-bold text-brand-red">
        <span
          aria-hidden="true"
          className="inline-block w-1.5 h-1.5 rounded-full bg-brand-red"
        />
        Low Stock — {stock_quantity} left
      </p>
    );
  }

  return (
    <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] font-bold text-ink">
      <span
        aria-hidden="true"
        className="inline-block w-1.5 h-1.5 rounded-full bg-ink"
      />
      In Stock
    </p>
  );
}
