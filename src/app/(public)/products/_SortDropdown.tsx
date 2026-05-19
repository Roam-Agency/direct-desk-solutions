"use client";

/**
 * Sort dropdown for the listing pages.
 *
 * Writes the chosen sort to ?sort=... in the URL and lets the server
 * component re-fetch. Uses useRouter().push so the URL change is
 * shareable / bookmarkable.
 *
 * Plain native <select> for v1 — accessible by default, no library
 * needed, looks fine with the right typography.
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LISTING_SORTS, type ListingSort } from "@/lib/products/fetch";

export default function SortDropdown({ current }: { current: ListingSort }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(params.toString());
    next.set("sort", e.target.value);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <label className="flex items-center gap-3">
      <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink/60">
        Sort
      </span>
      <select
        value={current}
        onChange={onChange}
        className="text-xs font-bold uppercase tracking-[0.12em] bg-paper border border-rule px-3 py-2 focus:outline-none focus:border-ink"
      >
        {LISTING_SORTS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
