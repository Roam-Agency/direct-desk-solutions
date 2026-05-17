/**
 * Format helpers for product display.
 *
 * Money in this codebase lives in two forms:
 *   - integer pence (the DB shape, e.g. 49900)
 *   - display string with currency symbol (e.g. "£499.00")
 *
 * Always convert at the edges (display, form input parsing) so the
 * core code never has to worry about float drift.
 */

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

export function formatPence(pence: number | null | undefined): string {
  if (pence === null || pence === undefined) return "—";
  return GBP.format(pence / 100);
}

/**
 * Parse a user-entered price string (e.g. "499", "499.00", "£499.00") into
 * integer pence. Returns null for empty/invalid input.
 */
export function parseDisplayPriceToPence(input: string): number | null {
  const cleaned = input.replace(/[£,\s]/g, "").trim();
  if (cleaned === "") return null;
  const asNumber = Number(cleaned);
  if (Number.isNaN(asNumber) || asNumber < 0) return null;
  return Math.round(asNumber * 100);
}

