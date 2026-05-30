import Link from "next/link";
import {
  listCustomers,
  CUSTOMER_SORTS,
  DEFAULT_CUSTOMER_SORT,
  type CustomerSort,
} from "@/lib/customers/fetch";
import { formatPence } from "@/lib/products/format";
import { SectionHeader } from "../_ui/SectionHeader";

interface CustomersPageProps {
  searchParams: Promise<{
    search?: string;
    sort?: string;
  }>;
}

/**
 * Normalise the sort query param against the known set. Anything we
 * don't recognise falls back to the default — defensive against junk
 * URLs and stale bookmarks.
 */
function normaliseSort(raw: string | undefined): CustomerSort {
  const known = CUSTOMER_SORTS.map((s) => s.value);
  if (raw && known.includes(raw as CustomerSort)) {
    return raw as CustomerSort;
  }
  return DEFAULT_CUSTOMER_SORT;
}

/**
 * Build a /admin/customers?... URL that preserves whichever filter
 * the caller is NOT changing. Same pattern as the products page's
 * buildHref helper.
 */
function buildHref(
  currentSearch: string,
  currentSort: CustomerSort,
  patch: { search?: string; sort?: CustomerSort }
): string {
  const search = patch.search ?? currentSearch;
  const sort = patch.sort ?? currentSort;
  const params = new URLSearchParams();
  if (search.trim().length > 0) params.set("search", search);
  if (sort !== DEFAULT_CUSTOMER_SORT) params.set("sort", sort);
  const qs = params.toString();
  return qs ? `/admin/customers?${qs}` : "/admin/customers";
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

function formatDate(iso: string | null): string {
  if (!iso) return "\u2014";
  return DATE_FORMAT.format(new Date(iso));
}

function customerName(c: {
  first_name: string | null;
  last_name: string | null;
}): string {
  const parts = [c.first_name, c.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "\u2014";
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const params = await searchParams;
  const search = (params.search ?? "").trim();
  const sort = normaliseSort(params.sort);

  const { customers, error } = await listCustomers({ search, sort });

  const exportHref = (() => {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (sort !== DEFAULT_CUSTOMER_SORT) qs.set("sort", sort);
    const trailing = qs.toString();
    return trailing
      ? `/admin/customers/export.csv?${trailing}`
      : "/admin/customers/export.csv";
  })();

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="People"
        title="Customers"
        action={
          <a
            href={exportHref}
            className="border border-ink bg-ink px-4 py-2 text-xs font-bold uppercase tracking-widest text-paper transition hover:bg-brand-red hover:border-brand-red"
          >
            Export CSV
          </a>
        }
      />
      <p className="text-sm text-ink/60">
        {customers.length} {customers.length === 1 ? "customer" : "customers"}
        {search && ` matching "${search}"`}
      </p>

      {/* Filters row \u2014 search box + sort dropdown */}
      <div className="flex flex-wrap items-end gap-4">
        {/* Search */}
        <form method="get" action="/admin/customers" className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="block w-full sm:w-auto">
            <span className="block text-xs font-bold uppercase tracking-widest text-ink/60">
              Search by email
            </span>
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="hello@example.com"
              className="mt-1 w-full border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder-ink/30 focus:border-ink focus:outline-none sm:w-64"
            />
          </label>
          {/* Preserve sort across search submits */}
          {sort !== DEFAULT_CUSTOMER_SORT && (
            <input type="hidden" name="sort" value={sort} />
          )}
          <button
            type="submit"
            className="border border-ink bg-paper px-4 py-2 text-xs font-bold uppercase tracking-widest text-ink transition hover:bg-ink hover:text-paper"
          >
            Search
          </button>
          {search && (
            <Link
              href={buildHref(search, sort, { search: "" })}
              className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-ink/60 transition hover:text-brand-red"
            >
              Clear
            </Link>
          )}
        </form>

        {/* Sort */}
        <form method="get" action="/admin/customers" className="ml-auto flex items-end gap-2">
          {search && <input type="hidden" name="search" value={search} />}
          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-widest text-ink/60">
              Sort by
            </span>
            <select
              name="sort"
              defaultValue={sort}
              className="mt-1 border border-rule bg-paper px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
            >
              {CUSTOMER_SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="border border-ink bg-paper px-4 py-2 text-xs font-bold uppercase tracking-widest text-ink transition hover:bg-ink hover:text-paper"
          >
            Apply
          </button>
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div className="border border-brand-red bg-brand-red/10 px-4 py-3 text-sm text-ink">
          Could not load customers: {error}
        </div>
      )}

      {/* Table or empty */}
      {!error && customers.length === 0 && (
        <div className="border border-rule bg-paper px-6 py-12 text-center">
          <p className="text-sm text-ink/60">
            {search
              ? `No customers match "${search}".`
              : "No customers yet. They'll appear here after the first order completes."}
          </p>
        </div>
      )}

      {/* Table — desktop / tablet. Hidden on phones; card list below. */}
      {!error && customers.length > 0 && (
        <div className="hidden overflow-x-auto border border-rule sm:block">
          <table className="min-w-full divide-y divide-rule">
            <thead className="bg-ink/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-ink/60">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-ink/60">
                  Name
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-widest text-ink/60">
                  Orders
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-widest text-ink/60">
                  Spent
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-ink/60">
                  Last order
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-ink/60">
                  Marketing
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule bg-paper">
              {customers.map((c) => (
                <tr key={c.id} className="transition hover:bg-ink/5">
                  <td className="px-4 py-3 text-sm">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="font-bold text-ink transition hover:text-brand-red"
                    >
                      {c.email}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-ink/80">
                    {customerName(c)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums">
                    {c.total_orders}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold tabular-nums">
                    {formatPence(c.total_spent_pence)}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink/80 tabular-nums">
                    {formatDate(c.last_order_at)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.marketing_consent ? (
                      <span
                        title={`Opted in ${formatDate(c.marketing_consent_at)}`}
                        className="inline-block h-2 w-2 rounded-full bg-brand-red"
                      />
                    ) : (
                      <span className="text-xs text-ink/30">\u2014</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Card list — mobile only. */}
      {!error && customers.length > 0 && (
        <ul className="divide-y divide-rule border border-rule sm:hidden">
          {customers.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/customers/${c.id}`}
                className="block p-3 transition hover:bg-ink/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-ink">
                      {c.email}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-ink/70">
                      {customerName(c)}
                    </span>
                  </span>
                  {c.marketing_consent && (
                    <span
                      title={`Opted in ${formatDate(c.marketing_consent_at)}`}
                      className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-brand-red"
                      aria-label="Marketing opt-in"
                    />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink/60">
                  <span className="tabular-nums">
                    {c.total_orders} order{c.total_orders === 1 ? "" : "s"}
                  </span>
                  <span className="text-ink/30">·</span>
                  <span className="font-bold tabular-nums text-ink">
                    {formatPence(c.total_spent_pence)}
                  </span>
                  <span className="text-ink/30">·</span>
                  <span className="tabular-nums">
                    Last {formatDate(c.last_order_at)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
