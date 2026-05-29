import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DraftProductButton } from "./_DraftProductButton";
import { SectionHeader } from "../_ui/SectionHeader";
import { ProductGallery } from "./_ProductGallery";
import { ProductsTable } from "./_ProductsTable";
import { ViewSwitcher } from "./_ViewSwitcher";

type StatusFilter = "all" | "live" | "draft" | "archived";
type ConditionFilter = "all" | "new" | "used";

interface ProductsPageProps {
  searchParams: Promise<{
    status?: string;
    condition?: string;
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

/**
 * Build a /admin/products?status=...&condition=... URL preserving the
 * other filter. Used by the tab + pill links so they don't reset each other.
 */
function buildHref(
  currentStatus: StatusFilter,
  currentCondition: ConditionFilter,
  patch: { status?: StatusFilter; condition?: ConditionFilter }
): string {
  const status = patch.status ?? currentStatus;
  const condition = patch.condition ?? currentCondition;
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (condition !== "all") params.set("condition", condition);
  const qs = params.toString();
  return qs ? `/admin/products?${qs}` : "/admin/products";
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const status = normaliseStatus(params.status);
  const condition = normaliseCondition(params.condition);

  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("*")
    .order("updated_at", { ascending: false });

  // "All" means the working catalogue (live + draft). Archived products
  // are hidden here and surfaced only under the Archived tab, so day-to-day
  // the list isn't cluttered with items pulled from sale.
  if (status === "all") query = query.neq("status", "archived");
  else query = query.eq("status", status);
  if (condition !== "all") query = query.eq("condition", condition);

  const { data: products, error } = await query;

  // Fetch hero images for the visible product set so the IMAGE column
  // can render real thumbnails. One additional round-trip; small N
  // because the page is admin-only and the catalogue is small.
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
            buildHref(status, condition, { status: v as StatusFilter })
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
            buildHref(status, condition, { condition: v as ConditionFilter })
          }
        />
      </div>

      <div className="mt-8">
        {error ? (
          <ErrorState message={error.message} />
        ) : !products || products.length === 0 ? (
          <EmptyState />
        ) : (
          <ViewSwitcher
            table={
              <ProductsTable
                rows={products}
                heroes={Object.fromEntries(heroByProductId)}
              />
            }
            gallery={<ProductGallery rows={products} heroByProductId={heroByProductId} />}
          />
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
              className={
                isActive
                  ? "border border-ink bg-ink px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-paper"
                  : "border border-rule px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-ink/60 transition hover:border-ink hover:text-ink"
              }
            >
              {opt.label}
            </Link>
          );
        })}
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

