/**
 * Listing filter constants + parsers.
 *
 * Sibling to listing-sort.ts. Lives in its own module (no Supabase
 * imports, no next/headers) so client components can pull the parsing
 * helpers without dragging server-only deps into client bundles.
 */

/**
 * Condition filter for the brand landing page.
 * "all" means no filter (server treats it as "don't add a .eq("condition")").
 */
export type ConditionFilter = "all" | "new" | "used";

export const CONDITION_FILTERS: { value: ConditionFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "used", label: "Used" },
];

export const DEFAULT_CONDITION_FILTER: ConditionFilter = "all";

/**
 * Parse the ?condition= URL param. Defaults to "all" on missing /
 * unknown values.
 */
export function parseConditionFilter(
  raw: string | string[] | undefined
): ConditionFilter {
  if (typeof raw === "string" && (["all", "new", "used"] as const).includes(
    raw as ConditionFilter
  )) {
    return raw as ConditionFilter;
  }
  return DEFAULT_CONDITION_FILTER;
}

/**
 * Parse the ?brands= URL param.
 *
 * Expected format: comma-separated slugs ("herman-miller,steelcase").
 * Returns the unique, non-empty slugs as an array. Empty / unknown
 * input returns [].
 *
 * The page is responsible for validating slugs against the actual
 * brand list (so a malformed slug doesn't poison the query); this
 * function only parses the raw string.
 */
export function parseBrandSlugs(
  raw: string | string[] | undefined
): string[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  const slugs = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 100);
  // Dedupe while preserving order.
  return Array.from(new Set(slugs));
}
