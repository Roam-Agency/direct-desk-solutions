/**
 * Pure helpers for translating between cart shapes, Stripe shapes,
 * and DB shapes. No SDK import — safe to use from server actions
 * or webhook routes without dragging the Stripe instance along.
 */

/**
 * Lowercase + trim an email for use as the natural key in the
 * customers table. Stripe gives us whatever the buyer typed.
 *
 *   "  Andy@Example.com  " → "andy@example.com"
 */
export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Split a full name into first/last for the customers table.
 * Stripe gives us a single "name" field. We do best-effort split:
 *   - Empty / whitespace → { first: null, last: null }
 *   - Single word        → { first: word, last: null }
 *   - Multiple words     → { first: first-word, last: rest joined }
 *
 * This is intentionally simple. Names are weird and we'd rather have
 * approximate first/last than guess wrongly with a NLP model.
 */
export function splitName(raw: string | null | undefined): {
  first: string | null;
  last: string | null;
} {
  if (!raw) return { first: null, last: null };
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  if (parts.length === 1) return { first: parts[0], last: null };
  return {
    first: parts[0],
    last: parts.slice(1).join(" "),
  };
}
