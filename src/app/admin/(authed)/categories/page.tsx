import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import {
  CategoriesBrowser,
  type BrowserCategory,
} from "./_CategoriesBrowser";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type CategoryKind = Database["public"]["Enums"]["category_kind"];

const KIND_ORDER: CategoryKind[] = ["functional", "brand", "merchandising"];

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

  // Group by kind, then flatten each kind into an ordered, depth-tagged list
  // (top-level rows followed by their children) so the client browser can
  // render and filter from a single flat array.
  const byKind: Record<CategoryKind, CategoryRow[]> = {
    functional: [],
    brand: [],
    merchandising: [],
  };
  for (const c of categories ?? []) {
    byKind[c.kind as CategoryKind].push(c as CategoryRow);
  }

  const flat: BrowserCategory[] = [];
  for (const kind of KIND_ORDER) {
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
    for (const top of tops) {
      flat.push(toBrowserCategory(top, 0, productCounts));
      for (const child of childrenByParent.get(top.id) ?? []) {
        flat.push(toBrowserCategory(child, 1, productCounts));
      }
    }
  }

  return (
    <div className="space-y-8">
      <div className="border-b-2 border-ink pb-5">
        <h1 className="text-4xl font-black tracking-tight">Categories</h1>
        <p className="mt-2 text-sm text-ink/60">
          Taxonomy for the catalogue. Three kinds, each browseable separately
          on the customer site.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/admin/categories/new"
            className="bg-ink px-5 py-3 text-xs font-bold uppercase tracking-widest text-paper transition hover:bg-brand-red"
          >
            + New category
          </Link>
          <Link
            href={
              showArchived
                ? "/admin/categories"
                : "/admin/categories?show=archived"
            }
            className="border border-rule px-5 py-3 text-xs font-bold uppercase tracking-widest text-ink/60 transition hover:border-ink hover:text-ink"
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </Link>
        </div>
      </div>

      <CategoriesBrowser categories={flat} />
    </div>
  );
}

function toBrowserCategory(
  c: CategoryRow,
  depth: number,
  productCounts: Map<string, number>
): BrowserCategory {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    kind: c.kind as BrowserCategory["kind"],
    sort_order: c.sort_order,
    is_active: c.is_active,
    depth,
    productCount: productCounts.get(c.id) ?? 0,
  };
}
