/**
 * Server-side fetch helpers for the /admin/orders surfaces.
 *
 * Module assumes a cookie-bound Supabase client (createClient(), not
 * createAdminClient()). Admin pages call these inside server components
 * after the (authed) layout has validated the session.
 *
 * Mirrors src/lib/customers/fetch.ts in shape and conventions:
 *   - 500-row cap, no pagination yet
 *   - Sort tokens are an exported union; pages normalise the query
 *     param against ORDER_SORTS before calling in
 *   - Returns { rows, error: string | null } so callers can branch
 *     without try/catch
 *
 * The shape of listOrders differs in one way from listCustomers:
 * search filters on the JOINED customers.email column via an inner
 * join. Orders carry customer_id but not email; routing email
 * search through the FK is cleaner than a two-pass fetch-then-filter
 * because Postgres can index the join.
 */

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItemRow =
  Database["public"]["Tables"]["order_items"]["Row"];
export type OrderStatus = Database["public"]["Enums"]["order_status"];

/**
 * Slim customer projection inlined onto orders list/detail rows.
 *
 * The list page only renders email + name in its rows; the detail
 * page renders the same plus a link out to /admin/customers/[id].
 * Pulling these three fields via the FK saves a second query per
 * page render without overfetching.
 */
export type CustomerLite = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

/**
 * OrderRow + the inlined customer projection. Returned by listOrders
 * and getOrderById so the calling page renders header + table without
 * a separate customer fetch.
 */
export type OrderWithCustomer = OrderRow & {
  customer: CustomerLite | null;
};

export type OrderSort =
  | "placed_desc"
  | "placed_asc"
  | "total_desc"
  | "customer_email_asc";

export const DEFAULT_ORDER_SORT: OrderSort = "placed_desc";

export const ORDER_SORTS: { value: OrderSort; label: string }[] = [
  { value: "placed_desc", label: "Newest first" },
  { value: "placed_asc", label: "Oldest first" },
  { value: "total_desc", label: "Highest total" },
  { value: "customer_email_asc", label: "Customer email A\u2013Z" },
];

/**
 * All allowed status filter values plus "all" sentinel. The list page
 * renders these as filter pills; the route handler validates against
 * this set before passing to listOrders.
 */
export type OrderStatusFilter = OrderStatus | "all";

export const ORDER_STATUS_FILTERS: OrderStatusFilter[] = [
  "all",
  "pending",
  "paid",
  "fulfilled",
  "backorder",
  "cancelled",
  "refunded",
];

interface ListOpts {
  status?: OrderStatusFilter;
  search?: string;
  sort?: OrderSort;
  limit?: number;
}

/**
 * Apply the sort to the query. Sort token validation happens at the
 * page boundary; this function trusts its input.
 *
 * Note "customer_email_asc" sorts on the joined customers.email
 * column. PostgREST accepts dotted column references on related
 * tables when an inner join exists in the select.
 */
function applySort<Q extends { order: (col: string, opts: { ascending: boolean; nullsFirst?: boolean; foreignTable?: string }) => Q }>(
  query: Q,
  sort: OrderSort
): Q {
  switch (sort) {
    case "placed_desc":
      return query.order("created_at", { ascending: false });
    case "placed_asc":
      return query.order("created_at", { ascending: true });
    case "total_desc":
      return query.order("total_pence", { ascending: false });
    case "customer_email_asc":
      return query.order("email", {
        ascending: true,
        foreignTable: "customers",
      });
  }
}

/**
 * List orders, optionally filtered by status, customer email
 * substring, or order ID prefix.
 *
 * The search behaviour deliberately overloads on the input shape:
 *   - If the search looks like the first 8 chars of a UUID (8 hex
 *     chars only, no @), we ilike on orders.id with a trailing
 *     wildcard.
 *   - Otherwise we ilike on customers.email (containing match).
 * This matches Brief 19 spec: "search matches email substring OR
 * order ID first-8".
 *
 * 500-row cap. Real order volume is expected to be <200/month at
 * launch; we add pagination if/when that no longer fits.
 */
export async function listOrders(
  opts: ListOpts = {}
): Promise<{ orders: OrderWithCustomer[]; error: string | null }> {
  const supabase = await createClient();
  const sort = opts.sort ?? DEFAULT_ORDER_SORT;
  const limit = opts.limit ?? 500;
  const status = opts.status ?? "all";

  let query = supabase
    .from("orders")
    .select(
      "*, customer:customers!inner(id, email, first_name, last_name)"
    );

  if (status !== "all") {
    query = query.eq("status", status);
  }

  if (opts.search && opts.search.trim().length > 0) {
    const raw = opts.search.trim();
    if (/^[0-9a-f]{8}$/i.test(raw)) {
      // 8-char hex prefix — treat as order ID prefix match.
      query = query.ilike("id", `${raw}%`);
    } else {
      // Anything else — escape ilike wildcards and search emails.
      const escaped = raw.replace(/[%_]/g, "\\$&");
      query = query.ilike("customers.email", `%${escaped}%`);
    }
  }

  query = applySort(query, sort).limit(limit);

  const { data, error } = await query;

  if (error) {
    return { orders: [], error: error.message };
  }
  // PostgREST's nested-select returns the related row as a property
  // on each parent. With !inner the property is guaranteed populated
  // for every returned order, but the generated types still mark it
  // optional/array because the relationship metadata can't tell
  // !inner apart from a left join. Narrow once here so callers see
  // a clean OrderWithCustomer.
  type Raw = OrderRow & {
    customer: CustomerLite | CustomerLite[] | null;
  };
  const rows: OrderWithCustomer[] = (data ?? []).map((row: Raw) => {
    const customer = Array.isArray(row.customer)
      ? (row.customer[0] ?? null)
      : row.customer;
    return { ...row, customer };
  });
  return { orders: rows, error: null };
}

/**
 * Fetch a single order by id with its customer inlined. Returns null
 * if not found. The detail page calls this; line items come from
 * getLineItemsForOrder below.
 */
export async function getOrderById(
  id: string
): Promise<OrderWithCustomer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "*, customer:customers!inner(id, email, first_name, last_name)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  type Raw = OrderRow & {
    customer: CustomerLite | CustomerLite[] | null;
  };
  const raw = data as Raw;
  const customer = Array.isArray(raw.customer)
    ? (raw.customer[0] ?? null)
    : raw.customer;
  return { ...raw, customer };
}

/**
 * Fetch all line items for an order, ordered by their creation order
 * (effectively the order they were added to the cart). The order_items
 * table carries product_snapshot JSONB so we never need to join back
 * to products for historical orders — important because products can
 * be archived between the order being placed and the admin viewing it.
 */
export async function getLineItemsForOrder(
  orderId: string
): Promise<{ items: OrderItemRow[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    return { items: [], error: error.message };
  }
  return { items: data ?? [], error: null };
}
