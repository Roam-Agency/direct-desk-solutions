/**
 * Cart type definitions.
 *
 * A CartItem is a lean snapshot — just enough to render the drawer / cart
 * page without re-fetching, plus identifiers to refresh against the live
 * DB on /cart load (see refresh.ts).
 *
 * Money in pence per the codebase convention.
 *
 * The snapshot includes `stockAtAdd` so we can detect stock-went-to-zero
 * (or below qty) drift on /cart load without an extra round-trip.
 */

export type CartCondition = "new" | "used";
export type CartGrade = "A" | "B" | "C" | null;

export type CartItem = {
  productId: string;       // uuid, source of truth for refresh
  slug: string;            // for link-back to product page
  name: string;
  brand: string | null;
  condition: CartCondition;
  grade: CartGrade;
  heroUrl: string | null;  // Cloudinary URL, may be null if no images
  pricePence: number;      // snapshot at add-time
  stockAtAdd: number;      // snapshot at add-time, drives qty clamp on /cart
  qty: number;             // pinned to 1 for used items
  addedAt: number;         // unix ms, for sort order if ever needed
};

export type CartState = {
  items: CartItem[];
  // mounted = true once localStorage hydration has run on the client.
  // Pre-mount, UI that depends on cart state (count badge, totals)
  // must render blank/empty to avoid SSR/CSR mismatch.
  mounted: boolean;
};

export type CartAction =
  | { type: "HYDRATE"; items: CartItem[] }
  | { type: "ADD"; item: Omit<CartItem, "qty" | "addedAt"> & { qty?: number } }
  | { type: "REMOVE"; productId: string }
  | { type: "SET_QTY"; productId: string; qty: number }
  | { type: "CLEAR" };
