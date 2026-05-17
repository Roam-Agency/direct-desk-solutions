import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPence } from "@/lib/products/format";
import type { Database } from "@/types/database";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
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

  if (status !== "all") query = query.eq("status", status);
  if (condition !== "all") query = query.eq("condition", condition);

  const { data: products, error } = await query;

  return (
    <div>
      <div className="flex items-end justify-between border-b border-rule pb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ink/60">
            Catalogue
          </p>
          <h1 className="mt-1 text-4xl font-black tracking-tight">Products</h1>
        </div>
        <Link
          href="/admin/products/new"
          className="bg-ink px-5 py-3 text-xs font-bold uppercase tracking-widest text-paper transition hover:bg-brand-red"
        >
          New product
        </Link>
      </div>

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
          <ProductTable rows={products} />
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

function ProductTable({ rows }: { rows: ProductRow[] }) {
  return (
    <div className="overflow-hidden border border-rule">
      <table className="w-full">
        <thead className="bg-ink text-paper">
          <tr>
            <Th>Image</Th>
            <Th>SKU</Th>
            <Th>Name</Th>
            <Th>Brand</Th>
            <Th>Condition</Th>
            <Th className="text-right">Price</Th>
            <Th>Stock</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-t border-rule transition hover:bg-rule/30"
            >
              <Td>
                <ProductThumbnailPlaceholder />
              </Td>
              <Td>
                <Link
                  href={`/admin/products/${row.id}`}
                  className="font-mono text-xs text-ink hover:text-brand-red"
                >
                  {row.sku}
                </Link>
              </Td>
              <Td>
                <Link
                  href={`/admin/products/${row.id}`}
                  className="font-bold text-ink hover:text-brand-red"
                >
                  {row.name}
                </Link>
              </Td>
              <Td className="text-ink/70">{row.brand ?? "—"}</Td>
              <Td>
                <ConditionLabel
                  condition={row.condition}
                  grade={row.condition_grade}
                />
              </Td>
              <Td className="text-right font-bold tabular-nums">
                {formatPence(row.price_pence)}
              </Td>
              <Td className="tabular-nums">{row.stock_quantity}</Td>
              <Td>
                <StatusLabel status={row.status} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-widest ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

/**
 * Placeholder for product thumbnail. The image upload pipeline lands in
 * the next sub-phase; this stub keeps the table layout honest in the
 * meantime so we are not redesigning the row when images arrive.
 */
function ProductThumbnailPlaceholder() {
  return (
    <div className="h-12 w-12 border border-rule bg-rule/40" aria-hidden />
  );
}

function ConditionLabel({
  condition,
  grade,
}: {
  condition: ProductRow["condition"];
  grade: ProductRow["condition_grade"];
}) {
  if (condition === "new") {
    return <span className="text-ink/80">New</span>;
  }
  return (
    <span className="text-ink/80">
      Used <span className="text-ink/40">·</span>{" "}
      <span className="font-mono text-ink/60">Grade {grade ?? "?"}</span>
    </span>
  );
}

function StatusLabel({ status }: { status: ProductRow["status"] }) {
  if (status === "live") {
    return (
      <span className="text-xs font-bold uppercase tracking-widest text-green-700">
        Live
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span className="text-xs font-bold uppercase tracking-widest text-ink/40">
        Draft
      </span>
    );
  }
  return (
    <span className="text-xs font-bold uppercase tracking-widest text-ink/40 line-through">
      Archived
    </span>
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
      <Link
        href="/admin/products/new"
        className="mt-6 inline-block bg-ink px-5 py-3 text-xs font-bold uppercase tracking-widest text-paper transition hover:bg-brand-red"
      >
        New product
      </Link>
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

