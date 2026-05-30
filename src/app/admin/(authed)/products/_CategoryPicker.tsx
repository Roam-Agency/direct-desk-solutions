"use client";

import { useMemo, useState } from "react";
import type { Database } from "@/types/database";

type CategoryKind = Database["public"]["Enums"]["category_kind"];
type CategoryLite = {
  id: string;
  name: string;
  slug: string;
  kind: CategoryKind;
};

type Props = {
  allCategories: CategoryLite[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

const KIND_ORDER: CategoryKind[] = ["functional", "brand", "merchandising"];
const KIND_LABELS: Record<CategoryKind, string> = {
  functional: "Functional",
  brand: "Brand",
  merchandising: "Merchandising",
};

/**
 * Grouped checkbox picker for assigning categories to a product.
 *
 * Selection state is fully controlled by the parent (selectedIds + onChange).
 *
 * The taxonomy grew large, so instead of three always-open columns:
 *   - A search box filters categories by name across every kind.
 *   - Each kind is a collapsible section with a "(n)" selected badge so you
 *     can fold away groups you're not using. Folding is presentation only —
 *     a collapsed section's selections stay in selectedIds and submit fine.
 *   - While a search is active, sections force-expand so matches are always
 *     visible regardless of collapsed state.
 *
 * If there are no active categories at all, renders a hint pointing the
 * admin to the Categories section rather than an empty void.
 */
export function CategoryPicker({
  allCategories,
  selectedIds,
  onChange,
}: Props) {
  const [query, setQuery] = useState("");
  // Collapsed sections by kind. Default: all expanded (empty set).
  const [collapsed, setCollapsed] = useState<Set<CategoryKind>>(new Set());

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const trimmedQuery = query.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;

  const byKind = useMemo(() => {
    const map: Record<CategoryKind, CategoryLite[]> = {
      functional: [],
      brand: [],
      merchandising: [],
    };
    for (const c of allCategories) {
      if (isSearching && !c.name.toLowerCase().includes(trimmedQuery)) continue;
      map[c.kind].push(c);
    }
    return map;
  }, [allCategories, isSearching, trimmedQuery]);

  if (allCategories.length === 0) {
    return (
      <p className="text-sm text-ink/60">
        No categories yet. Create some in the Categories section.
      </p>
    );
  }

  function toggle(id: string) {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function toggleSection(kind: CategoryKind) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  const totalMatches = KIND_ORDER.reduce(
    (sum, kind) => sum + byKind[kind].length,
    0
  );

  return (
    <div className="space-y-4">
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
        const cats = byKind[kind];
        if (cats.length === 0) return null;

        // Count selected within this kind across the FULL list (not the
        // filtered view) so the badge stays accurate while searching.
        const selectedInKind = allCategories.filter(
          (c) => c.kind === kind && selectedSet.has(c.id)
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
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ink/40">
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
                {cats.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSet.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="h-4 w-4 shrink-0 accent-brand-red"
                    />
                    <span className="text-ink">{c.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
