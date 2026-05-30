import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { ArchiveButton } from "./_ArchiveButton";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type CategoryKind = Database["public"]["Enums"]["category_kind"];

const KIND_ORDER: CategoryKind[] = ["functional", "brand", "merchandising"];
const KIND_TITLES: Record<CategoryKind, string> = {
  functional: "Functional",
  brand: "Brand",
  merchandising: "Merchandising",
};
const KIND_DESCRIPTIONS: Record<CategoryKind, string> = {
  functional: "The main customer browse axis — what kind of furniture is it.",
  brand: "Manufacturer-led browse, especially for the used catalogue.",
  merchandising: "Time-bound rails like Clearance and New Arrivals.",
};

interface PageProps {
  searchParams: Promise<{ show?: string }>;
}

export default async function CategoriesPage({ searchParams }: PageProps) {
  const { show } = await searchParams;
  const showArchived = show === "archived";

  const supabase = await createClient();
  const query = supabase
    .from("categories")
    .select("*, product_categories(product_id)")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!showArchived) {
    query.eq("is_active", true);
  }

  const { data: categories, error } = await query;

  if (error) {
    return (
      <div className="border-l-4 border-brand-red bg-brand-red/5 px-4 py-3 text-sm text-brand-red">
        Failed to load categories: {error.message}
      </div>
    );
  }

  // Count products per category from the embedded join rows.
  const productCounts = new Map<string, number>();
  for (const c of categories ?? []) {
    const raw = (c as unknown as { product_categories?: unknown[] })
      .product_categories;
    productCounts.set(c.id, Array.isArray(raw) ? raw.length : 0);
  }

  // Group by kind, then build per-kind tree by parent_id.
  const byKind: Record<CategoryKind, CategoryRow[]> = {
    functional: [],
    brand: [],
    merchandising: [],
  };
  for (const c of categories ?? []) {
    byKind[c.kind as CategoryKind].push(c as CategoryRow);
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-5">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Categories</h1>
          <p className="mt-2 text-sm text-ink/60">
            Taxonomy for the catalogue. Three kinds, each browseable separately
            on the customer site.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={
              showArchived
                ? "/admin/categories"
                : "/admin/categories?show=archived"
            }
            className="text-xs font-bold uppercase tracking-widest text-ink/60 transition hover:text-ink"
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </Link>
          <Link
            href="/admin/categories/new"
            className="bg-ink px-5 py-3 text-xs font-bold uppercase tracking-widest text-paper transition hover:bg-brand-red"
          >
            + New category
          </Link>
        </div>
      </div>

      {KIND_ORDER.map((kind) => {
        const rows = byKind[kind];
        const tops = rows.filter((r) => !r.parent_id);
        const childrenByParent = new Map<string, CategoryRow[]>();
        for (const r of rows) {
          if (r.parent_id) {
            const arr = childrenByParent.get(r.parent_id) ?? [];
            arr.push(r);
            childrenByParent.set(r.parent_id, arr);
          }
        }

        return (
          <section key={kind} className="border-t border-rule pt-8">
            <div className="mb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-ink/60">
                {KIND_TITLES[kind]}
              </h2>
              <p className="mt-1 text-xs text-ink/40">
                {KIND_DESCRIPTIONS[kind]}
              </p>
            </div>

            {tops.length === 0 ? (
              <p className="py-6 text-sm text-ink/40">
                No {KIND_TITLES[kind].toLowerCase()} categories yet.
              </p>
            ) : (
              (() => {
                // Flatten tops + their children into one ordered, depth-tagged
                // list so the table and the mobile card list render from the
                // same source.
                const ordered = tops.flatMap((top) => [
                  { category: top, depth: 0 },
                  ...(childrenByParent.get(top.id) ?? []).map((child) => ({
                    category: child,
                    depth: 1,
                  })),
                ]);

                return (
                  <>
                    {/* Desktop / tablet: full table. Hidden on phones, where
                        the 6 columns overflow and the Status/actions column is
                        clipped — the mobile card list below replaces it. */}
                    <div className="hidden overflow-x-auto sm:block">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-rule text-left text-xs font-bold uppercase tracking-widest text-ink/60">
                            <th className="py-2 pr-4">Name</th>
                            <th className="py-2 pr-4">Slug</th>
                            <th className="py-2 pr-4">Products</th>
                            <th className="py-2 pr-4">Order</th>
                            <th className="py-2 pr-4">Status</th>
                            <th className="py-2 text-right" />
                          </tr>
                        </thead>
                        <tbody>
                          {ordered.map(({ category, depth }) => (
                            <CategoryTableRow
                              key={category.id}
                              category={category}
                              productCount={productCounts.get(category.id) ?? 0}
                              depth={depth}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile: stacked cards. */}
                    <ul className="divide-y divide-rule border border-rule sm:hidden">
                      {ordered.map(({ category, depth }) => (
                        <CategoryCard
                          key={category.id}
                          category={category}
                          productCount={productCounts.get(category.id) ?? 0}
                          depth={depth}
                        />
                      ))}
                    </ul>
                  </>
                );
              })()
            )}
          </section>
        );
      })}
    </div>
  );
}

function StatusPill({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-block bg-emerald-100 px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-emerald-800">
      Active
    </span>
  ) : (
    <span className="inline-block bg-ink/10 px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-ink/60">
      Archived
    </span>
  );
}

function CategoryTableRow({
  category,
  productCount,
  depth,
}: {
  category: CategoryRow;
  productCount: number;
  depth: number;
}) {
  return (
    <tr className="border-b border-rule/40 text-sm">
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          {depth > 0 && (
            <span className="text-ink/30" aria-hidden>
              └
            </span>
          )}
          <Link
            href={`/admin/categories/${category.id}`}
            className="font-bold text-ink transition hover:text-brand-red"
          >
            {category.name}
          </Link>
        </div>
      </td>
      <td className="py-3 pr-4 font-mono text-xs text-ink/60">
        {category.slug}
      </td>
      <td className="py-3 pr-4 font-mono text-xs">{productCount}</td>
      <td className="py-3 pr-4 font-mono text-xs text-ink/60">
        {category.sort_order}
      </td>
      <td className="py-3 pr-4">
        <StatusPill isActive={category.is_active} />
      </td>
      <td className="py-3 text-right">
        <ArchiveButton
          categoryId={category.id}
          isActive={category.is_active}
        />
      </td>
    </tr>
  );
}

/**
 * Mobile equivalent of a table row. Name (with child indent) + status pill
 * on the top line, then a metadata line (slug · products · order) and the
 * archive/restore action — laid out vertically so nothing is clipped on a
 * phone the way the 6-column table was.
 */
function CategoryCard({
  category,
  productCount,
  depth,
}: {
  category: CategoryRow;
  productCount: number;
  depth: number;
}) {
  return (
    <li className={depth > 0 ? "pl-4" : undefined}>
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {depth > 0 && (
              <span className="shrink-0 text-ink/30" aria-hidden>
                └
              </span>
            )}
            <Link
              href={`/admin/categories/${category.id}`}
              className="font-bold text-ink transition hover:text-brand-red"
            >
              {category.name}
            </Link>
          </div>
          <p className="mt-1 break-all font-mono text-[11px] text-ink/50">
            {category.slug}
          </p>
          <p className="mt-1 font-mono text-[11px] text-ink/60">
            {productCount} product{productCount === 1 ? "" : "s"}
            <span className="text-ink/30"> · </span>
            order {category.sort_order}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusPill isActive={category.is_active} />
          <ArchiveButton
            categoryId={category.id}
            isActive={category.is_active}
          />
        </div>
      </div>
    </li>
  );
}
