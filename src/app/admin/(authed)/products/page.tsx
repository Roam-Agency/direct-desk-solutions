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
const PAGE_SIZE = 50;

interface ProductsPageProps {
  searchParams: Promise<{
    status?: string;
    condition?: string;
    page?: string;
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

/**
 * Build a /admin/products?status=...&condition=...&page=... URL preserving
 * the other filters. Changing the status or condition resets to page 1
 * (the old page number is meaningless against a different result set);
 * passing an explicit page keeps the current filters and jumps pages.
 */
function buildHref(
  currentStatus: StatusFilter,
  currentCondition: ConditionFilter,
  currentPage: number,
  patch: { status?: StatusFilter; condition?: ConditionFilter; page?: number }
): string {
  const status = patch.status ?? currentStatus;
  const condition = patch.condition ?? currentCondition;
  const filterChanged =
    patch.status !== undefined || patch.condition !== undefined;
  const page = patch.page ?? (filterChanged ? 1 : currentPage);

  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (condition !== "all") params.set("condition", condition);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/products?${qs}` : "/admin/products";
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const status = normaliseStatus(params.status);
  const condition = normaliseCondition(params.condition);
  const page = normalisePage(params.page);

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

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

  const { data: products, count, error } = await query;

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rangeStart = totalCount === 0 ? 0 : from + 1;
  const rangeEnd = Math.min(from + PAGE_SIZE, totalCount);

  // Fetch hero images for the visible product set so the IMAGE column
  // can render real thumbnails. One additional round-trip, bounded to the
  // current page (≤ PAGE_SIZE ids) rather than the whole catalogue.
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
            buildHref(status, condition, page, { status: v as StatusFilter })
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
            buildHref(status, condition, page, {
              condition: v as ConditionFilter,
            })
          }
        />
      </div>

      <div className="mt-8">
        {error ? (
          <ErrorState message={error.message} />
        ) : !products || products.length === 0 ? (
          <EmptyState />
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
              hrefFor={(p) => buildHref(status, condition, page, { page: p })}
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
 * Page navigation for the products list. Shows "Showing X–Y of N" and
 * Previous / Next links that preserve the active filters. Prev/Next carry a
 * LoadingHint so a click on a slow page gives the same immediate feedback as
 * the filter tabs. Prev is disabled on the first page, Next on the last.
 */
function Pagination({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  totalCount,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  totalCount: number;
  hrefFor: (page: number) => string;
}) {
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
      <p className="text-xs font-bold uppercase tracking-widest text-ink/50">
        Showing {rangeStart}–{rangeEnd} of {totalCount}
      </p>
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

function EmptyState() {
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

