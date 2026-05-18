"use client";

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
 * Renders three columns (one per kind), each with its categories as
 * checkboxes. Selection state is fully controlled by the parent.
 *
 * If there are no active categories at all, renders a hint pointing
 * the admin to /admin/categories rather than an empty void.
 */
export function CategoryPicker({
  allCategories,
  selectedIds,
  onChange,
}: Props) {
  if (allCategories.length === 0) {
    return (
      <p className="text-sm text-ink/60">
        No categories yet. Create some in the Categories section.
      </p>
    );
  }

  const selectedSet = new Set(selectedIds);

  function toggle(id: string) {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  const byKind: Record<CategoryKind, CategoryLite[]> = {
    functional: [],
    brand: [],
    merchandising: [],
  };
  for (const c of allCategories) {
    byKind[c.kind].push(c);
  }

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
      {KIND_ORDER.map((kind) => {
        const cats = byKind[kind];
        if (cats.length === 0) return null;
        return (
          <div key={kind}>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink/40">
              {KIND_LABELS[kind]}
            </h4>
            <div className="space-y-2">
              {cats.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedSet.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="accent-brand-red"
                  />
                  <span>{c.name}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
