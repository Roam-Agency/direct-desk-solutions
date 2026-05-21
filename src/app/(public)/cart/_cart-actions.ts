"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Cart refresh server action.
 *
 * Takes a list of product IDs from the client's localStorage cart and
 * returns current price + stock + status for each one. The client
 * compares against the snapshot it has and surfaces drift inline.
 *
 * RLS notes:
 *   - Uses createClient() (cookie-bound). Only returns rows where
 *     status='live' is visible per the existing buyer-side RLS.
 *   - Status filter is also applied explicitly so an archived row
 *     (visible somehow) still surfaces as "no longer available".
 *
 * Return shape:
 *   { ok: true, data: { items: RefreshResult[] } }
 *   { ok: false, formError: string }
 *
 * Each item:
 *   { productId, found, pricePence, stockQuantity }
 *   - found=false when the row is missing/archived. pricePence and
 *     stockQuantity are 0 in that case.
 */

export type CartItemRefresh = {
  productId: string;
  found: boolean;
  pricePence: number;
  stockQuantity: number;
};

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; formError?: string };

export async function refreshCartItems(
  productIds: string[]
): Promise<ActionResult<{ items: CartItemRefresh[] }>> {
  // Defensive: empty input short-circuits to empty output. Avoids
  // the .in('id', []) edge case which some Supabase clients treat
  // as "match all".
  if (productIds.length === 0) {
    return { ok: true, data: { items: [] } };
  }

  // Cap to a sensible upper bound. A cart with 100+ items is more
  // likely a bug than a real session.
  if (productIds.length > 100) {
    return { ok: false, formError: "Too many cart items to refresh" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("id, price_pence, stock_quantity, status")
    .in("id", productIds)
    .eq("status", "live");

  if (error) {
    console.error("refreshCartItems error", { error });
    return { ok: false, formError: "Could not refresh cart items" };
  }

  // Build a lookup so we can answer per-input-id without N round-trips.
  const byId = new Map(data.map((row) => [row.id, row]));

  const items: CartItemRefresh[] = productIds.map((productId) => {
    const row = byId.get(productId);
    if (!row) {
      return {
        productId,
        found: false,
        pricePence: 0,
        stockQuantity: 0,
      };
    }
    return {
      productId,
      found: true,
      pricePence: row.price_pence,
      stockQuantity: row.stock_quantity,
    };
  });

  return { ok: true, data: { items } };
}
