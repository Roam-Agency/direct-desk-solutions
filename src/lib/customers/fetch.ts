/**
 * Server-side fetch helpers for the /admin/customers surfaces.
 *
 * Module assumes a cookie-bound Supabase client (i.e. uses
 * createClient(), not createAdminClient()). Admin pages call these
 * inside server components; the cookie session is already validated
 * by the (authed) layout one step up.
 *
 * All helpers return strict-typed rows from src/types/database.ts.
 * Filter inputs are normalised at the page boundary, not here \u2014
 * keep this module dumb about what counts as a valid sort key.
 */

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

export type CustomerSort =
  | "last_order_desc"
  | "last_order_asc"
  | "total_spent_desc"
  | "total_orders_desc"
  | "email_asc"
  | "created_desc";

export const DEFAULT_CUSTOMER_SORT: CustomerSort = "last_order_desc";

export const CUSTOMER_SORTS: { value: CustomerSort; label: string }[] = [
  { value: "last_order_desc", label: "Most recent order" },
  { value: "last_order_asc", label: "Oldest recent order" },
  { value: "total_spent_desc", label: "Highest spend" },
  { value: "total_orders_desc", label: "Most orders" },
  { value: "email_asc", label: "Email A\u2013Z" },
  { value: "created_desc", label: "Newest signups" },
];

interface ListOpts {
  search?: string;
  sort?: CustomerSort;
  limit?: number;
}

/**
 * Map a CustomerSort token to its (column, direction, nullsFirst) tuple.
 *
 * Date columns may be null (customer signed up but never ordered).
 * For DESC orders we want recent-first with nulls AFTER the populated
 * rows so the table top stays useful. For ASC we want the oldest
 * actual order, again with nulls last.
 */
function applySort<Q extends { order: (col: string, opts: { ascending: boolean; nullsFirst?: boolean }) => Q }>(
  query: Q,
  sort: CustomerSort
): Q {
  switch (sort) {
    case "last_order_desc":
      return query.order("last_order_at", { ascending: false, nullsFirst: false });
    case "last_order_asc":
      return query.order("last_order_at", { ascending: true, nullsFirst: false });
    case "total_spent_desc":
      return query.order("total_spent_pence", { ascending: false });
    case "total_orders_desc":
      return query.order("total_orders", { ascending: false });
    case "email_asc":
      return query.order("email", { ascending: true });
    case "created_desc":
      return query.order("created_at", { ascending: false });
  }
}

/**
 * List customers, optionally filtered by an email search substring.
 *
 * Search uses ilike on the email column. Names are NOT searched \u2014
 * email is the canonical identity here and adding name search now
 * would risk false positives that hide the customer the admin is
 * actually looking for.
 *
 * Cap at 500 by default. The catalogue is unlikely to exceed this
 * for a long time; if it does we add pagination then, not now.
 */
export async function listCustomers(
  opts: ListOpts = {}
): Promise<{ customers: CustomerRow[]; error: string | null }> {
  const supabase = await createClient();
  const sort = opts.sort ?? DEFAULT_CUSTOMER_SORT;
  const limit = opts.limit ?? 500;

  let query = supabase.from("customers").select("*");

  if (opts.search && opts.search.trim().length > 0) {
    // Escape % and _ which are ilike wildcards; otherwise a search for
    // "100%" becomes a much broader match than the user intends.
    const escaped = opts.search.trim().replace(/[%_]/g, "\\$&");
    query = query.ilike("email", `%${escaped}%`);
  }

  query = applySort(query, sort).limit(limit);

  const { data, error } = await query;

  if (error) {
    return { customers: [], error: error.message };
  }
  return { customers: data ?? [], error: null };
}

/**
 * Fetch a single customer by id. Returns null if not found.
 *
 * Distinct from listCustomers because the detail page needs the
 * row by id even when search/sort don't apply.
 */
export async function getCustomerById(
  id: string
): Promise<CustomerRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/**
 * Fetch all orders for a given customer, newest first.
 *
 * The detail page renders them in a small table; expected count per
 * customer is small (single-digit for most, tens for the top spenders).
 */
export async function getOrdersForCustomer(
  customerId: string
): Promise<{ orders: OrderRow[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    return { orders: [], error: error.message };
  }
  return { orders: data ?? [], error: null };
}
