#!/usr/bin/env python3
"""
Hotfix — Session 3 build failure
=================================

The build broke because _SortDropdown.tsx (client component) imports
from @/lib/products/fetch, which imports @/lib/supabase/server, which
uses next/headers (server-only). Bundling next/headers into a client
component fails.

Fix: extract the listing sort constants into their own pure data file
that has no Supabase imports. Client components import from there;
server components import the fetch helpers as before.

Files touched:
  - NEW    src/lib/products/listing-sort.ts
  - PATCH  src/lib/products/fetch.ts       (re-export from listing-sort)
  - PATCH  src/app/(public)/products/_SortDropdown.tsx
  - PATCH  src/app/(public)/products/new/page.tsx
  - PATCH  src/app/(public)/products/used/page.tsx

Idempotent: detects already-applied state.
"""

import sys
from pathlib import Path

ROOT = Path.cwd()
if not (ROOT / "src" / "app" / "(public)").exists():
    print("ERROR: run from project root (~/Desk Direct/direct-desk-solutions)")
    sys.exit(1)


def write_file(path: Path, content: str, what: str) -> None:
    if path.exists() and path.read_text() == content:
        print(f"  [skip] {what} — already present")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    print(f"  [write] {what}")


def patch_file(path: Path, old: str, new: str, what: str) -> None:
    src = path.read_text()
    if new in src:
        print(f"  [skip] {what} — already applied")
        return
    assert old in src, f"anchor not found in {path}: {what}"
    assert src.count(old) == 1, f"anchor not unique in {path}: {what}"
    path.write_text(src.replace(old, new))
    print(f"  [patch] {what}")


# ---------------------------------------------------------------------------
# Step 1 — new pure-data module
# ---------------------------------------------------------------------------
print("\n=== Step 1: create listing-sort.ts (pure data, no imports) ===")

listing_sort_module = """/**
 * Listing sort constants.
 *
 * Pure data. Lives in its own file so client components (the sort
 * dropdown) can import the type + options list without pulling in
 * fetch.ts \\u2014 which transitively imports next/headers via the
 * Supabase server client and would break a client component bundle.
 *
 * Server components import these via fetch.ts for ergonomics (one
 * import for the type + the helper). Client components import from
 * here directly.
 */

export type ListingSort = "price-asc" | "price-desc" | "newest";

export const LISTING_SORTS: { value: ListingSort; label: string }[] = [
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest First" },
];

export const DEFAULT_LISTING_SORT: ListingSort = "price-asc";
"""

write_file(
    ROOT / "src" / "lib" / "products" / "listing-sort.ts",
    listing_sort_module,
    "listing-sort.ts (new module)",
)


# ---------------------------------------------------------------------------
# Step 2 — fetch.ts now re-exports from listing-sort.ts
# ---------------------------------------------------------------------------
print("\n=== Step 2: fetch.ts re-exports from listing-sort ===")

old_block = """/**
 * The accepted sort options for the public listing pages. Kept in this
 * one place so the listing page, the sort dropdown, and the fetch helper
 * all agree on what's valid.
 */
export type ListingSort = "price-asc" | "price-desc" | "newest";

export const LISTING_SORTS: { value: ListingSort; label: string }[] = [
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest First" },
];

export const DEFAULT_LISTING_SORT: ListingSort = "price-asc";"""

new_block = """/**
 * Listing sort constants live in their own module so client components
 * can import them without pulling in the Supabase server client (which
 * uses next/headers and breaks client bundles). Re-export here so
 * server callers can import the helper + type from one place.
 */
export type { ListingSort } from "./listing-sort";
export {
  LISTING_SORTS,
  DEFAULT_LISTING_SORT,
} from "./listing-sort";"""

fetch_path = ROOT / "src" / "lib" / "products" / "fetch.ts"
patch_file(
    fetch_path,
    old_block,
    new_block,
    "fetch.ts re-exports from listing-sort",
)

# Also need to add the import of ListingSort as a type inside fetch.ts so
# the listLiveProducts signature still compiles
old_import = """import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";"""

new_import = """import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { ListingSort } from "./listing-sort";
import { DEFAULT_LISTING_SORT as _DEFAULT_SORT } from "./listing-sort";"""

patch_file(
    fetch_path,
    old_import,
    new_import,
    "fetch.ts adds explicit ListingSort imports",
)

# Update the listLiveProducts function to use _DEFAULT_SORT and the
# imported ListingSort type. The re-export of DEFAULT_LISTING_SORT
# remains for external consumers; the underscore-prefixed alias is
# what listLiveProducts uses internally so the re-export and the
# local-use don't collide.
old_default = "const sortBy = opts.sortBy ?? DEFAULT_LISTING_SORT;"
new_default = "const sortBy = opts.sortBy ?? _DEFAULT_SORT;"

patch_file(
    fetch_path,
    old_default,
    new_default,
    "fetch.ts listLiveProducts uses local default sort alias",
)


# ---------------------------------------------------------------------------
# Step 3 — _SortDropdown imports from listing-sort, not fetch
# ---------------------------------------------------------------------------
print("\n=== Step 3: _SortDropdown imports from listing-sort ===")

sort_dropdown_path = ROOT / "src" / "app" / "(public)" / "products" / "_SortDropdown.tsx"
patch_file(
    sort_dropdown_path,
    'import { LISTING_SORTS, type ListingSort } from "@/lib/products/fetch";',
    'import { LISTING_SORTS, type ListingSort } from "@/lib/products/listing-sort";',
    "_SortDropdown imports from listing-sort (not fetch)",
)


# ---------------------------------------------------------------------------
# Step 4 — listing pages: imports from both for clarity
# ---------------------------------------------------------------------------
# The server pages can keep importing from fetch.ts (everything is
# re-exported) so no change needed there. But let's be explicit and
# split the import for readability — the function comes from fetch,
# the type+default come from listing-sort.
print("\n=== Step 4: listing pages \u2014 split imports for clarity ===")

for cond in ("new", "used"):
    page_path = ROOT / "src" / "app" / "(public)" / "products" / cond / "page.tsx"
    old = """import {
  listLiveProducts,
  DEFAULT_LISTING_SORT,
  type ListingSort,
} from "@/lib/products/fetch";"""
    new = """import { listLiveProducts } from "@/lib/products/fetch";
import {
  DEFAULT_LISTING_SORT,
  type ListingSort,
} from "@/lib/products/listing-sort";"""
    patch_file(page_path, old, new, f"/products/{cond}/page.tsx split imports")


print("\n\nAll hotfix patches applied.")
print("\nNext:")
print("  npx tsc --noEmit       # verify types")
print("  git add -A")
print("  git commit -m \"fix(public): extract listing-sort constants to break client/server import cycle\"")
print("  git push")
