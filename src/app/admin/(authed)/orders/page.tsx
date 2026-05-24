import Link from "next/link";
import {
  listOrders,
  ORDER_SORTS,
  DEFAULT_ORDER_SORT,
  ORDER_STATUS_FILTERS,
  type OrderSort,
  type OrderStatusFilter,
} from "@/lib/orders/fetch";
import { formatPence } from "@/lib/products/format";

interface OrdersPageProps {
  searchParams: Promise<{
    status?: string;
    search?: string;
    sort?: string;
  }>;
}

/**
 * Normalise the sort query param. Anything we don't recognise falls
 * back to the default — defensive against junk URLs and stale bookmarks.
 */
function normaliseSort(raw: string | undefined): OrderSort {
  const known = ORDER_SORTS.map((s) => s.value);
  if (raw && known.includes(raw as OrderSort)) {
    return raw as OrderSort;
  }
  return DEFAULT_ORDER_SORT;
}

/**
 * Normalise the status filter against the known set. Defaults to
 * "all" so the list starts unfiltered.
 */
function normaliseStatus(raw: string | undefined): OrderStatusFilter {
  if (raw && ORDER_STATUS_FILTERS.includes(raw as OrderStatusFilter)) {
    return raw as OrderStatusFilter;
  }
  return "all";
}

/**
 * Build a /admin/orders?... URL that preserves whichever filters the
 * caller is NOT changing. Mirrors the customers page's buildHref.
 */
function buildHref(
  current: { status: OrderStatusFilter; search: string; sort: OrderSort },
  patch: {
    status?: OrderStatusFilter;
    search?: string;
    sort?: OrderSort;
  }
): string {
  const status = patch.status ?? current.status;
  const search = patch.search ?? current.search;
  const sort = patch.sort ?? current.sort;
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (search.trim().length > 0) params.set("search", search);
  if (sort !== DEFAULT_ORDER_SORT) params.set("sort", sort);
  const qs = params.toString();
  return qs ? `/admin/orders?${qs}` : "/admin/orders";
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(iso: string | null): string {
  if (!iso) return "\u2014";
  return DATE_FORMAT.format(new Date(iso));
}

function customerName(c: {
  first_name: string | null;
  last_name: string | null;
} | null): string {
  if (!c) return "\u2014";
  const parts = [c.first_name, c.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "\u2014";
}

/**
 * Human label for each status. We could derive these from the enum
 * but a lookup table reads better and lets us tweak copy without
 * touching the type.
 */
const STATUS_LABELS: Record<OrderStatusFilter, string> = {
  all: "All",
  pending: "Pending",
  paid: "Paid",
  fulfilled: "Fulfilled",
  backorder: "Backorder",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/**
 * Status pill styling. backorder is always red so an open backorder
 * pulls the eye even from the unselected state. Other statuses are
 * inert grey/ink and only fill in when selected.
 */
function statusPillClasses(
  status: OrderStatusFilter,
  isActive: boolean
): string {
  const base =
    "inline-flex items-center border px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition";
  if (isActive) {
    if (status === "backorder") {
      return `${base} border-brand-red bg-brand-red text-paper`;
    }
    return `${base} border-ink bg-ink text-paper`;
  }
  if (status === "backorder") {
    return `${base} border-brand-red text-brand-red hover:bg-brand-red hover:text-paper`;
  }
  return `${base} border-rule text-ink/70 hover:border-ink hover:text-ink`;
}

/**
 * Status badge for the table row. Same colour grammar as the pills
 * (backorder always red) but smaller and inline.
 */
function statusBadgeClasses(status: string): string {
  const base =
    "inline-block border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest";
  if (status === "backorder") {
    return `${base} border-brand-red bg-brand-red text-paper`;
  }
  if (status === "paid") {
    return `${base} border-ink bg-ink text-paper`;
  }
  if (status === "fulfilled") {
    return `${base} border-ink/40 bg-ink/10 text-ink`;
  }
  if (status === "refunded" || status === "cancelled") {
    return `${base} border-rule bg-paper text-ink/50`;
  }
  // pending and anything unknown
  return `${base} border-rule bg-paper text-ink/70`;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;
  const status = normaliseStatus(params.status);
  const search = (params.search ?? "").trim();
  const sort = normaliseSort(params.sort);

  const { orders, error } = await listOrders({ status, search, sort });

  const current = { status, search, sort };

  const exportHref = (() => {
    const qs = new URLSearchParams();
    if (status !== "all") qs.set("status", status);
    if (search) qs.set("search", search);
    if (sort !== DEFAULT_ORDER_SORT) qs.set("sort", sort);
    const trailing = qs.toString();
    return trailing
      ? `/admin/orders/export.csv?${trailing}`
      : "/admin/orders/export.csv";
  })();

  return (
    <div className="space-y-8">
      {/* Header row \u2014 title + Export CSV */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Orders</h1>
          <p className="mt-1 text-sm text-ink/60">
            {orders.length} {orders.length === 1 ? "order" : "orders"}
            {status !== "all" && ` \u00b7 ${STATUS_LABELS[status]}`}
            {search && ` matching "${search}"`}
          </p>
        </div>
        <a
          href={exportHref}
          className="border border-ink bg-ink px-4 py-2 text-xs font-bold uppercase tracking-widest text-paper transition hover:bg-brand-red hover:border-brand-red">
          Export CSV
        </a>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {ORDER_STATUS_FILTERS.map((s) => (
          <Link
            key={s}
            href={buildHref(current, { status: s })}
            className={statusPillClasses(s, s === status)}>
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      {/* Filter row \u2014 search + sort */}
      <div className="flex flex-wrap items-end gap-4">
        {/* Search */}
        <form
          method="get"
          action="/admin/orders"
          className="flex items-end gap-2">
          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-widest text-ink/60">
              Search by email or order ID
            </span>
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="hello@example.com or abcd1234"
              className="mt-1 w-72 border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder-ink/30 focus:border-ink focus:outline-none"
            />
          </label>
          {/* Preserve status + sort across search submits */}
          {status !== "all" && (
            <input type="hidden" name="status" value={status} />
          )}
          {sort !== DEFAULT_ORDER_SORT && (
            <input type="hidden" name="sort" value={sort} />
          )}
          <button
            type="submit"
            className="border border-ink bg-paper px-4 py-2 text-xs font-bold uppercase tracking-widest text-ink transition hover:bg-ink hover:text-paper">
            Search
          </button>
          {search && (
            <Link
              href={buildHref(current, { search: "" })}
              className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-ink/60 transition hover:text-brand-red">
              Clear
            </Link>
          )}
        </form>

        {/* Sort */}
        <form
          method="get"
          action="/admin/orders"
          className="ml-auto flex items-end gap-2">
          {status !== "all" && (
            <input type="hidden" name="status" value={status} />
          )}
          {search && <input type="hidden" name="search" value={search} />}
          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-widest text-ink/60">
              Sort by
            </span>
            <select
              name="sort"
              defaultValue={sort}
              className="mt-1 border border-rule bg-paper px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none">
              {ORDER_SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="border border-ink bg-paper px-4 py-2 text-xs font-bold uppercase tracking-widest text-ink transition hover:bg-ink hover:text-paper">
            Apply
          </button>
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div className="border border-brand-red bg-brand-red/10 px-4 py-3 text-sm text-ink">
          Could not load orders: {error}
        </div>
      )}

      {/* Empty state */}
      {!error && orders.length === 0 && (
        <div className="border border-rule bg-paper px-6 py-12 text-center">
          <p className="text-sm text-ink/60">
            {search || status !== "all"
              ? "No orders match the current filters."
              : "No orders yet. They'll appear here after the first checkout completes."}
          </p>
        </div>
      )}

      {/* Table */}
      {!error && orders.length > 0 && (
        <div className="overflow-x-auto border border-rule">
          <table className="min-w-full divide-y divide-rule">
            <thead className="bg-ink/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-ink/60">
                  Order
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-ink/60">
                  Placed
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-ink/60">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-ink/60">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-widest text-ink/60">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule bg-paper">
              {orders.map((o) => {
                const isBackorder = o.status === "backorder";
                return (
                  <tr
                    key={o.id}
                    className={
                      isBackorder
                        ? "border-l-4 border-l-brand-red transition hover:bg-ink/5"
                        : "transition hover:bg-ink/5"
                    }>
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="font-bold text-ink transition hover:text-brand-red">
                        <span className="font-mono">{o.id.slice(0, 8)}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink/80 tabular-nums">
                      {formatDate(o.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {o.customer ? (
                        <Link
                          href={`/admin/customers/${o.customer.id}`}
                          className="text-ink transition hover:text-brand-red">
                          <div className="font-bold">{o.customer.email}</div>
                          <div className="text-xs text-ink/60">
                            {customerName(o.customer)}
                          </div>
                        </Link>
                      ) : (
                        <span className="text-ink/40">{"\u2014"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusBadgeClasses(o.status)}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold tabular-nums">
                      {formatPence(o.total_pence)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
