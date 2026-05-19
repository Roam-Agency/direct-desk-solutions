/**
 * Listing sort constants.
 *
 * Pure data. Lives in its own file so client components (the sort
 * dropdown) can import the type + options list without pulling in
 * fetch.ts \u2014 which transitively imports next/headers via the
 * Supabase server client and would break a client component bundle.
 *
 * Server components import these via fetch.ts for ergonomics (one
 * import for the type + the helper). Client components import from
 * here directly.
 */

export type ListingSort = "price-asc" | "price-desc" | "newest";

export const LISTING_SORTS: { value: ListingSort; label: string }[] = [
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest First" },
];

export const DEFAULT_LISTING_SORT: ListingSort = "price-asc";
