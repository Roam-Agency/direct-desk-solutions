import type { CartItem } from "./types";

/**
 * Cart math helpers. All inputs/outputs in pence to match codebase
 * convention. Format to GBP at the render boundary using
 * lib/products/format.ts.
 */

export function lineTotalPence(item: CartItem): number {
  return item.pricePence * item.qty;
}

export function cartTotalPence(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + lineTotalPence(item), 0);
}

export function cartItemCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.qty, 0);
}
