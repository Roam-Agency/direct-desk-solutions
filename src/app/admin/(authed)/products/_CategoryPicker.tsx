"use client";

import { useMemo, useState } from "react";
import type { Database } from "@/types/database";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type CategoryKind = Database["public"]["Enums"]["category_kind"];

const KIND_LABELS: Record<CategoryKind, string> = {
  functional: "Functional",
  brand: "Brand",
  merchandising: "Merchandising",
};

const KIND_ORDER: CategoryKind[] = ["functional", "brand", "merchandising"];

/**
 * Multi-select category picker grouped by kind.
 *
 * Seeds from `defaultSelectedIds` then manages its own Set of checked ids,
 * writing the full list into a hidden input (name="categoryIds") as
 * comma-joined values so the parent <form> server action picks it up with
 * the rest of the product fields. That contract is unchanged.
 *
 * The taxonomy grew large, so the flat list got unwieldy:
 *   - A search box filters categories by name across every kind.
 *   - Each kind is a collapsible section with a "(n selected)" badge so you
 *     can fold away groups you're not using. Folding is presentation only —
 *     selections in a collapsed section are still submitted.
 *   - While a search is active, sections force-expand so matches are always
 *     visible regardless of their collapsed state.
 */
export function CategoryPicker({
  categories,
  defaultSelectedIds,
}: {
  categories: CategoryRow[];
  defaultSelectedIds: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultSelectedIds)
  );
  const [query, setQuery] = useState("");
  // Collapsed sections by kind. Default: all expanded (empty set).
  const [collapsed, setCollapsed] = useState<Set<CategoryKind>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSection(kind: CategoryKind) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  const trimmedQuery = query.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;

  // Filter once, grouped by kind, memoised on the query + category list.
  const filteredByKind = useMemo(() => {
    const map = new Map<CategoryKind, CategoryRow[]>();
    for (const kind of KIND_ORDER) {
      const rows = categories.filter(
        (c) =>
          c.kind === kind &&
          (!isSearching || c.name.toLowerCase().includes(trimmedQuery))
      );
      map.set(kind, rows);
    }
    return map;
  }, [categories, isSearching, trimmedQuery]);

  const totalMatches = KIND_ORDER.reduce(
    (sum, kind) => sum + (filteredByKind.get(kind)?.length ?? 0),
    0
  );

  return (
    <div className="space-y-4">
      {/* Hidden input carries the selection into the form submit. */}
      <input
        type="hidden"
        name="categoryIds"
        value={Array.from(selected).join(",")}
      />

      {/* Search filter */}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search categories…"
        aria-label="Search categories"
        className="w-full border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder-ink/40 focus:border-ink focus:outline-none"
      />

      {isSearching && totalMatches === 0 && (
        <p className="text-sm text-ink/50">
          No categories match “{query.trim()}”.
        </p>
      )}

      {KIND_ORDER.map((kind) => {
        const rows = filteredByKind.get(kind) ?? [];
        if (rows.length === 0) return null;

        // Count selected within this kind across the FULL list (not the
        // filtered view) so the badge stays accurate while searching.
        const selectedInKind = categories.filter(
          (c) => c.kind === kind && selected.has(c.id)
        ).length;

        // While searching, force the section open so matches are visible.
        const isOpen = isSearching || !collapsed.has(kind);

        return (
          <div key={kind} className="border border-rule">
            <button
              type="button"
              onClick={() => toggleSection(kind)}
              aria-expanded={isOpen}
              disabled={isSearching}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-rule/30 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ink/60">
                {KIND_LABELS[kind]}
                {selectedInKind > 0 && (
                  <span className="rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-bold text-paper">
                    {selectedInKind}
                  </span>
                )}
              </span>
              <span
                aria-hidden
                className={
                  "text-ink/40 transition-transform " +
                  (isOpen ? "rotate-180" : "")
                }
              >
                ▾
              </span>
            </button>

            {isOpen && (
              <div className="space-y-2 border-t border-rule px-3 py-3">
                {rows.map((cat) => {
                  const isChecked = selected.has(cat.id);
                  return (
                    <label
                      key={cat.id}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(cat.id)}
                        className="h-4 w-4 shrink-0 cursor-pointer accent-brand-red"
                      />
                      <span className="text-sm text-ink group-hover:text-brand-red transition-colors">
                        {cat.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
