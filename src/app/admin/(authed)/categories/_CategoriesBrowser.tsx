"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArchiveButton } from "./_ArchiveButton";

type CategoryKind = "functional" | "brand" | "merchandising";

export type BrowserCategory = {
  id: string;
  name: string;
  slug: string;
  kind: CategoryKind;
  sort_order: number;
  is_active: boolean;
  depth: number;
  productCount: number;
};

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

/**
 * Client-side browser for the categories admin list.
 *
 * Receives the already-grouped, depth-tagged categories from the server
 * page and renders the kind sections (table on sm+, cards on mobile). Adds:
 *   - An instant search box filtering by name + slug (no round-trip).
 *   - Jump-to-kind anchor chips so you can hop to Functional / Brand /
 *     Merchandising without scrolling the long list.
 *
 * While searching, a child whose parent doesn't match is shown un-indented
 * so a lone match never looks orphaned.
 */
export function CategoriesBrowser({
  categories,
}: {
  categories: BrowserCategory[];
}) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim().toLowerCase();
  const isSearching = trimmed.length > 0;

  const byKind = useMemo(() => {
    const map: Record<CategoryKind, BrowserCategory[]> = {
      functional: [],
      brand: [],
      merchandising: [],
    };
    for (const c of categories) {
      if (
        isSearching &&
        !c.name.toLowerCase().includes(trimmed) &&
        !c.slug.toLowerCase().includes(trimmed)
      ) {
        continue;
      }
      map[c.kind].push(c);
    }
    return map;
  }, [categories, isSearching, trimmed]);

  const totalMatches = KIND_ORDER.reduce(
    (sum, k) => sum + byKind[k].length,
    0
  );

  // Only offer jump chips for kinds that have visible rows.
  const presentKinds = KIND_ORDER.filter((k) => byKind[k].length > 0);

  return (
    <div className="space-y-8">
      {/* Search + jump chips */}
      <div className="space-y-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search categories by name or slug…"
          aria-label="Search categories"
          className="w-full border border-rule bg-paper px-3 py-2.5 text-sm text-ink placeholder-ink/40 focus:border-ink focus:outline-none"
        />
        {!isSearching && presentKinds.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {presentKinds.map((k) => (
              <a
                key={k}
                href={`#kind-${k}`}
                className="border border-rule px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-ink/60 transition hover:border-ink hover:text-ink"
              >
                {KIND_TITLES[k]}
                <span className="ml-1 text-ink/40">{byKind[k].length}</span>
              </a>
            ))}
          </div>
        )}
        {isSearching && (
          <p className="text-xs font-bold uppercase tracking-widest text-ink/50">
            {totalMatches} result{totalMatches === 1 ? "" : "s"} for “
            {query.trim()}”
          </p>
        )}
      </div>

      {isSearching && totalMatches === 0 && (
        <p className="py-6 text-sm text-ink/50">
          No categories match “{query.trim()}”.
        </p>
      )}

      {KIND_ORDER.map((kind) => {
        const rows = byKind[kind];
        if (rows.length === 0) return null;

        return (
          <section
            key={kind}
            id={`kind-${kind}`}
            className="scroll-mt-20 border-t border-rule pt-8"
          >
            <div className="mb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-ink/60">
                {KIND_TITLES[kind]}
              </h2>
              <p className="mt-1 text-xs text-ink/40">
                {KIND_DESCRIPTIONS[kind]}
              </p>
            </div>

            {/* Desktop / tablet: table. Hidden on phones. */}
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
                  {rows.map((c) => (
                    <CategoryTableRow
                      key={c.id}
                      category={c}
                      // Indentation only makes sense in the full tree, not a
                      // filtered view — flatten while searching.
                      depth={isSearching ? 0 : c.depth}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: stacked cards. */}
            <ul className="divide-y divide-rule border border-rule sm:hidden">
              {rows.map((c) => (
                <CategoryCard
                  key={c.id}
                  category={c}
                  depth={isSearching ? 0 : c.depth}
                />
              ))}
            </ul>
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
  depth,
}: {
  category: BrowserCategory;
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
      <td className="py-3 pr-4 font-mono text-xs">{category.productCount}</td>
      <td className="py-3 pr-4 font-mono text-xs text-ink/60">
        {category.sort_order}
      </td>
      <td className="py-3 pr-4">
        <StatusPill isActive={category.is_active} />
      </td>
      <td className="py-3 text-right">
        <ArchiveButton categoryId={category.id} isActive={category.is_active} />
      </td>
    </tr>
  );
}

function CategoryCard({
  category,
  depth,
}: {
  category: BrowserCategory;
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
            {category.productCount} product{category.productCount === 1 ? "" : "s"}
            <span className="text-ink/30"> · </span>
            order {category.sort_order}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusPill isActive={category.is_active} />
          <ArchiveButton categoryId={category.id} isActive={category.is_active} />
        </div>
      </div>
    </li>
  );
}
