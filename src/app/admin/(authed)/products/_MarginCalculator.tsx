"use client";

import { parseDisplayPriceToPence } from "@/lib/products/format";

type Props = {
  price: string;
  costPrice: string;
};

/**
 * Live margin calculator. Renders nothing if either price is blank/zero/unparseable.
 *
 * Three numbers:
 *   - Margin £  =  price - cost                      (absolute profit per unit)
 *   - Margin %  =  (price - cost) / price * 100      (retailer's margin on sale)
 *   - Markup %  =  (price - cost) / cost * 100       (uplift over cost; clearance lens)
 *
 * Colour bands on Margin %:
 *   < 15%   red    (thin / loss zone)
 *   15-30%  amber  (acceptable)
 *   > 30%   green  (healthy)
 *
 * Pure derived display. No state. No effects.
 */
export function MarginCalculator({ price, costPrice }: Props) {
  const pricePence = parseDisplayPriceToPence(price);
  const costPence = parseDisplayPriceToPence(costPrice);

  if (
    pricePence === null ||
    pricePence === undefined ||
    costPence === null ||
    costPence === undefined ||
    pricePence <= 0 ||
    costPence <= 0
  ) {
    return null;
  }

  const marginPence = pricePence - costPence;
  const marginPct = (marginPence / pricePence) * 100;
  const markupPct = (marginPence / costPence) * 100;

  const isNegative = marginPence < 0;
  const band: "red" | "amber" | "green" =
    marginPct < 15 ? "red" : marginPct < 30 ? "amber" : "green";

  const bandClass =
    band === "red"
      ? "text-brand-red"
      : band === "amber"
        ? "text-amber-600"
        : "text-emerald-700";

  const marginPounds = (marginPence / 100).toFixed(2);
  const marginPctDisplay = marginPct.toFixed(1);
  const markupPctDisplay = markupPct.toFixed(1);

  return (
    <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-l-2 border-brand-red bg-rule/20 px-3 py-2 font-mono text-sm">
      <span className="text-ink/60">Live margin</span>
      <span className={isNegative ? "text-brand-red" : "text-ink"}>
        £{marginPounds}
      </span>
      <span className={bandClass}>{marginPctDisplay}% margin</span>
      <span className="text-ink/70">{markupPctDisplay}% markup</span>
    </div>
  );
}
