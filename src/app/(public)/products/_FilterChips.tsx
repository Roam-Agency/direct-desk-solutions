"use client";

/**
 * Filter chips for the listing pages.
 *
 * Two modes:
 *   - "brand": multi-select. Writes ?brands=slug1,slug2 (comma-separated).
 *     Toggling a chip on/off mutates the comma list. Empty list removes
 *     the param entirely (cleaner URLs than ?brands=).
 *   - "condition": single-select. Writes ?condition=new|used. Selecting
 *     the already-active value removes the param (back to "all").
 *
 * URL-state via useRouter().push, matching _SortDropdown's pattern so
 * filter + sort compose cleanly via shared URLSearchParams handling.
 *
 * Visual: horizontal-scroll chip strip on mobile, wraps to a row at
 * sm+. Bleeds to viewport edges via negative margin + matching px so
 * the leading/trailing chips can be partly visible (signals scrollability).
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";

type ChipOption = {
  value: string;
  label: string;
};

type BrandModeProps = {
  mode: "brand";
  options: ChipOption[];
  selected: string[];
};

type ConditionModeProps = {
  mode: "condition";
  options: ChipOption[];
  selected: string | null;
};

type FilterChipsProps = BrandModeProps | ConditionModeProps;

export default function FilterChips(props: FilterChipsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function navigateWith(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    const q = next.toString();
    router.push(q.length > 0 ? `${pathname}?${q}` : pathname);
  }

  function toggleBrand(value: string) {
    if (props.mode !== "brand") return;
    const current = new Set(props.selected);
    if (current.has(value)) current.delete(value);
    else current.add(value);
    const next = Array.from(current);
    navigateWith((p) => {
      if (next.length === 0) p.delete("brands");
      else p.set("brands", next.join(","));
    });
  }

  function setCondition(value: string) {
    if (props.mode !== "condition") return;
    navigateWith((p) => {
      if (props.selected === value) p.delete("condition");
      else p.set("condition", value);
    });
  }

  function clearAll() {
    navigateWith((p) => {
      if (props.mode === "brand") p.delete("brands");
      else p.delete("condition");
    });
  }

  const hasSelection =
    props.mode === "brand"
      ? props.selected.length > 0
      : props.selected !== null;

  function isActive(value: string): boolean {
    if (props.mode === "brand") return props.selected.includes(value);
    return props.selected === value;
  }

  // Selected count drives the mobile "N selected" hint + bolder Clear.
  const selectedCount =
    props.mode === "brand" ? props.selected.length : props.selected ? 1 : 0;

  return (
    <div>
      {/* Mobile-only hint row: makes it obvious the strip filters + scrolls,
          and surfaces the active count (otherwise a selected chip can be
          scrolled out of sight). Hidden at sm+ where chips wrap into view. */}
      <div className="flex items-center justify-between mb-2 sm:hidden">
        <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink/40">
          {props.mode === "brand" ? "Filter by brand" : "Filter"}
          <span className="ml-1 text-ink/30">· swipe</span>
        </span>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-[10px] uppercase tracking-[0.22em] font-bold text-brand-red"
          >
            Clear ({selectedCount})
          </button>
        )}
      </div>

      {/* Scroll strip. The right-edge fade (mask) signals there's more to
          scroll on mobile; it's removed at sm+ where chips wrap. */}
      <div className="relative">
        <div className="flex items-center gap-2 overflow-x-auto -mx-6 px-6 pb-1 sm:flex-wrap sm:mx-0 sm:px-0 sm:overflow-visible [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {props.options.map((opt) => {
            const active = isActive(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  props.mode === "brand"
                    ? toggleBrand(opt.value)
                    : setCondition(opt.value)
                }
                aria-pressed={active}
                className={[
                  "shrink-0 px-4 py-2.5 text-[11px] uppercase tracking-[0.18em] font-bold border transition-colors whitespace-nowrap",
                  active
                    ? "bg-ink text-paper border-ink hover:bg-brand-red hover:border-brand-red"
                    : "bg-paper text-ink/70 border-rule hover:border-ink hover:text-ink",
                ].join(" ")}
              >
                {opt.label}
              </button>
            );
          })}
          {/* Inline Clear at sm+ (the mobile hint row has its own). */}
          {hasSelection && (
            <button
              type="button"
              onClick={clearAll}
              aria-label="Clear all filters"
              className="hidden sm:inline-block shrink-0 ml-1 text-[11px] uppercase tracking-[0.18em] font-bold text-ink/60 hover:text-brand-red transition-colors px-2 py-2 whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>
        {/* Right-edge fade — purely decorative scroll affordance, mobile only. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-paper to-transparent sm:hidden"
        />
      </div>
    </div>
  );
}
