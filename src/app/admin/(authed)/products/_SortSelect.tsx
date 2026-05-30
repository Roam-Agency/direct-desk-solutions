"use client";

import { useRouter } from "next/navigation";

/**
 * Admin products sort control.
 *
 * A native <select> (accessible, mobile-friendly, no library) that
 * navigates to a server-built href on change. The parent passes a
 * `hrefByValue` map so all the URL construction — preserving the active
 * filters/search and resetting to page 1 — stays in the page's buildHref
 * helper rather than being re-derived here.
 */
export function SortSelect({
  current,
  options,
  hrefByValue,
}: {
  current: string;
  options: { value: string; label: string }[];
  hrefByValue: Record<string, string>;
}) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-3">
      <span className="text-xs font-bold uppercase tracking-widest text-ink/40">
        Sort
      </span>
      <select
        value={current}
        onChange={(e) => {
          const href = hrefByValue[e.target.value];
          if (href) router.push(href);
        }}
        className="border border-rule bg-paper px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-ink focus:border-ink focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
