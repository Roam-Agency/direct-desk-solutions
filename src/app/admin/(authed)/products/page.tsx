import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DraftProductButton } from "./_DraftProductButton";
import { SectionHeader } from "../_ui/SectionHeader";
import { ProductGallery } from "./_ProductGallery";
import { ProductsTable } from "./_ProductsTable";
import { ViewSwitcher } from "./_ViewSwitcher";
import { LoadingHint } from "./_LoadingHint";

type StatusFilter = "all" | "live" | "draft" | "archived";
type ConditionFilter = "all" | "new" | "used";

// How many products to show per page. The catalogue grew from a handful to
// ~14k rows; rendering them all in one go made every filter click block for
// seconds. A page-at-a-time keeps the query and the rendered table small.
// The user picks from PAGE_SIZE_OPTIONS via the "Per page" control.
const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

interface ProductsPageProps {
  searchParams: Promise<{
    status?: string;
    condition?: string;
    page?: string;
    size?: string;
    q?: string;
  }>;
}

function normaliseStatus(raw: string | undefined): StatusFilter {
  if (raw === "live" || raw === "draft" || raw === "archived") return raw;
  return "all";
}

function normaliseCondition(raw: string | undefined): ConditionFilter {
  if (raw === "new" || raw === "used") return raw;
  return "all";
}

function normalisePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function normalisePageSize(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n)
    ? n
    : DEFAULT_PAGE_SIZE;
}

function normaliseSearch(raw: string | undefined): string {
  // Trim and cap length — admin search has no need for huge inputs.
  return (raw ?? "").trim().slice(0, 100);
}

/**
 * Build a /admin/products?status=...&condition=...&page=...&size=...&q=... URL
 * preserving the other filters. Changing the status, condition, or page size
 * resets to page 1 (the old page number is meaningless against a different
 * result set or page size); passing an explicit page keeps everything else
 * and just jumps pages. `size` and `q` are only written when set/non-default
 * so the common URL stays clean. The active search `q` rides along on every
 * link so filtering and paging stay scoped to the search.
 */
function buildHref(
  currentStatus: StatusFilter,
  currentCondition: ConditionFilter,
  currentPage: number,
  currentSize: number,
  currentSearch: string,
  patch: {
    status?: StatusFilter;
    condition?: ConditionFilter;
    page?: number;
    size?: number;
  }
): string {
  const status = patch.status ?? currentStatus;
  const condition = patch.condition ?? currentCondition;
  const size = patch.size ?? currentSize;
  const filterChanged =
    patch.status !== undefined ||
    patch.condition !== undefined ||
    patch.size !== undefined;
  const page = patch.page ?? (filterChanged ? 1 : currentPage);

  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (condition !== "all") params.set("condition", condition);
  if (size !== DEFAULT_PAGE_SIZE) params.set("size", String(size));
  if (currentSearch) params.set("q", currentSearch);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/products?${qs}` : "/admin/products";
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const status = normaliseStatus(params.status);
  const condition = normaliseCondition(params.condition);
  const page = normalisePage(params.page);
  const pageSize = normalisePageSize(params.size);
  const search = normaliseSearch(params.q);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, to);

  // "All" means the working catalogue (live + draft). Archived products
  // are hidden here and surfaced only under the Archived tab, so day-to-day
  // the list isn't cluttered with items pulled from sale.
  if (status === "all") query = query.neq("status", "archived");
  else query = query.eq("status", status);
  if (condition !== "all") query = query.eq("condition", condition);

  // Free-text search across name + SKU. Escape ilike metacharacters (% _ \)
  // so a search for "100%" or "BUND_1" is treated literally, not as a
  // wildcard. ilike over ~14k rows is a few ms — no index needed; revisit
  // with a tsvector/trigram index only if the catalogue grows orders of
  // magnitude or we want ranked relevance.
  if (search) {
    const escaped = search.replace(/[\\%_]/g, "\\$&");
    const pattern = `%${escaped}%`;
    query = query.or(`name.ilike.${pattern},sku.ilike.${pattern}`);
  }

  const { data: products, count, error } = await query;

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : from + 1;
  const rangeEnd = Math.min(from + pageSize, totalCount);

  // Fetch hero images for the visible product set so the IMAGE column
  // can render real thumbnails. One additional round-trip, bounded to the
  // current page (≤ pageSize ids) rather than the whole catalogue.
  const productIds = (products ?? []).map((p) => p.id);
  const heroByProductId = new Map<
    string,
    { url: string; alt: string | null }
  >();
  if (productIds.length > 0) {
    const { data: heroes } = await supabase
      .from("product_images")
      .select("product_id, cloudinary_url, alt_text")
      .in("product_id", productIds)
      .eq("is_hero", true);
    for (const row of heroes ?? []) {
      heroByProductId.set(row.product_id, {
        url: row.cloudinary_url,
        alt: row.alt_text,
      });
    }
  }

  return (
    <div>
      <SectionHeader eyebrow="Catalogue" title="Products" />

      {/* Search by name or SKU. GET form so the query lands in the URL (?q=)
          and composes with the status/condition filters + pagination, which
          all read from searchParams. Status/condition/size ride along as
          hidden inputs so submitting a search doesn't drop the active
          filters; page is intentionally omitted so a new search starts at
          page 1. */}
      <form method="get" action="/admin/products" className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        {condition !== "all" && (
          <input type="hidden" name="condition" value={condition} />
        )}
        {pageSize !== DEFAULT_PAGE_SIZE && (
          <input type="hidden" name="size" value={String(pageSize)} />
        )}
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search name or SKU…"
          maxLength={100}
          aria-label="Search products by name or SKU"
          className="w-full border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder-ink/40 focus:border-ink focus:outline-none sm:w-80"
        />
        <button
          type="submit"
          className="border border-ink bg-ink px-4 py-2 text-xs font-bold uppercase tracking-widest text-paper transition hover:bg-brand-red"
        >
          Search
        </button>
        {search && (
          <Link
            href={buildHref("all", "all", 1, pageSize, "", {
              status,
              condition,
            })}
            prefetch={false}
            className="flex items-center px-2 py-2 text-xs font-bold uppercase tracking-widest text-ink/50 transition hover:text-brand-red"
          >
            Clear
            <LoadingHint />
          </Link>
        )}
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
        <Tabs
          label="Status"
          options={[
            { value: "all", label: "All" },
            { value: "live", label: "Live" },
            { value: "draft", label: "Draft" },
            { value: "archived", label: "Archived" },
          ]}
          current={status}
          buildHref={(v) =>
            buildHref(status, condition, page, pageSize, search, {
              status: v as StatusFilter,
            })
          }
        />
        <Tabs
          label="Condition"
          options={[
            { value: "all", label: "All" },
            { value: "new", label: "New" },
            { value: "used", label: "Used" },
          ]}
          current={condition}
          buildHref={(v) =>
            buildHref(status, condition, page, pageSize, search, {
              condition: v as ConditionFilter,
            })
          }
        />
      </div>

      {search && (
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-ink/50">
          {totalCount} result{totalCount === 1 ? "" : "s"} for “{search}”
        </p>
      )}

      <div className="mt-8">
        {error ? (
          <ErrorState message={error.message} />
        ) : !products || products.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          <>
            <ViewSwitcher
              table={
                <ProductsTable
                  rows={products}
                  heroes={Object.fromEntries(heroByProductId)}
                />
              }
              gallery={<ProductGallery rows={products} heroByProductId={heroByProductId} />}
            />
            <Pagination
              page={page}
              totalPages={totalPages}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              totalCount={totalCount}
              pageSize={pageSize}
              hrefFor={(p) =>
                buildHref(status, condition, page, pageSize, search, { page: p })
              }
              hrefForSize={(s) =>
                buildHref(status, condition, page, pageSize, search, { size: s })
              }
            />
          </>
        )}
      </div>
    </div>
  );
}

function Tabs({
  label,
  options,
  current,
  buildHref,
}: {
  label: string;
  options: { value: string; label: string }[];
  current: string;
  buildHref: (value: string) => string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold uppercase tracking-widest text-ink/40">
        {label}
      </span>
      <div className="flex gap-1">
        {options.map((opt) => {
          const isActive = opt.value === current;
          return (
            <Link
              key={opt.value}
              href={buildHref(opt.value)}
              prefetch={false}
              className={
                isActive
                  ? "flex items-center border border-ink bg-ink px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-paper"
                  : "flex items-center border border-rule px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-ink/60 transition hover:border-ink hover:text-ink"
              }
            >
              {opt.label}
              <LoadingHint />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Page navigation for the products list. Shows "Showing X–Y of N", a
 * "Per page" size selector (20 / 50 / 100), and Previous / Next links that
 * preserve the active filters. The size links and Prev/Next carry a
 * LoadingHint so a click on a slow page gives the same immediate feedback as
 * the filter tabs. Prev is disabled on the first page, Next on the last.
 */
function Pagination({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  totalCount,
  pageSize,
  hrefFor,
  hrefForSize,
}: {
  page: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  totalCount: number;
  pageSize: number;
  hrefFor: (page: number) => string;
  hrefForSize: (size: number) => string;
}) {
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-ink/50">
          Showing {rangeStart}–{rangeEnd} of {totalCount}
        </p>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs font-bold uppercase tracking-widest text-ink/40">
            Per page
          </span>
          {PAGE_SIZE_OPTIONS.map((size) => {
            const isActive = size === pageSize;
            return (
              <Link
                key={size}
                href={hrefForSize(size)}
                prefetch={false}
                aria-current={isActive ? "true" : undefined}
                className={
                  isActive
                    ? "flex items-center border border-ink bg-ink px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-paper"
                    : "flex items-center border border-rule px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-ink/60 transition hover:border-ink hover:text-ink"
                }
              >
                {size}
                <LoadingHint />
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-ink/40">
          Page {page} of {totalPages}
        </span>
        {hasPrev ? (
          <Link
            href={hrefFor(page - 1)}
            prefetch={false}
            className="flex items-center border border-rule px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-ink/60 transition hover:border-ink hover:text-ink"
          >
            Prev
            <LoadingHint />
          </Link>
        ) : (
          <span className="border border-rule px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-ink/25">
            Prev
          </span>
        )}
        {hasNext ? (
          <Link
            href={hrefFor(page + 1)}
            prefetch={false}
            className="flex items-center border border-rule px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-ink/60 transition hover:border-ink hover:text-ink"
          >
            Next
            <LoadingHint />
          </Link>
        ) : (
          <span className="border border-rule px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-ink/25">
            Next
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  if (search) {
    return (
      <div className="border border-dashed border-rule bg-paper px-6 py-16 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-ink/40">
          No products match “{search}”
        </p>
        <p className="mt-2 text-sm text-ink/60">
          Try a different name or SKU, or clear the search.
        </p>
      </div>
    );
  }
  return (
    <div className="border border-dashed border-rule bg-paper px-6 py-16 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-ink/40">
        No products match these filters
      </p>
      <p className="mt-2 text-sm text-ink/60">
        Try clearing the filters, or add a new product.
      </p>
      <DraftProductButton variant="empty-state" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="border-l-2 border-brand-red bg-paper px-4 py-3 text-sm text-ink">
      Failed to load products: {message}
    </div>
  );
}

