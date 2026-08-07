import type { Metadata } from "next";
import {
  searchProducts,
  listLiveProducts,
  listBrandsWithCounts,
  type ProductCard,
} from "@/lib/products/fetch";
import ListingGrid from "../products/_ListingGrid";
import FilterChips from "../products/_FilterChips";
import { parseBrandSlugs } from "@/lib/products/listing-filters";

export const metadata: Metadata = {
  title: "Search",
  description:
    "Search the Direct Desk Solutions catalogue — new and refurbished office furniture.",
};

// Next.js 16 routes receive searchParams as a Promise.
type SearchPageProps = {
  searchParams: Promise<{ q?: string; brands?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim();
  const brandSlugs = parseBrandSlugs(sp.brands);
  const hasQuery = query.length > 0;

  // Always fetch brands — the chip strip renders even on the empty
  // state so the buyer can see what's filterable. Search spans both
  // conditions, so counts stay unscoped, but zero-stock brands are
  // dropped (the imported catalogue has 100+ brand categories and a
  // chip for each buries the results). Selected slugs stay visible
  // even at zero count so a stale URL filter can still be untoggled.
  const brands = await listBrandsWithCounts();
  const brandOptions = brands
    .filter((b) => b.live_product_count > 0 || brandSlugs.includes(b.slug))
    .map((b) => ({ value: b.slug, label: b.name }));

  let results: ProductCard[] = [];
  let fallback: ProductCard[] = [];

  if (hasQuery) {
    results = await searchProducts({ query, brandSlugs });

    if (results.length === 0) {
      const [used, news] = await Promise.all([
        listLiveProducts({ condition: "used", brandSlugs }),
        listLiveProducts({ condition: "new", brandSlugs }),
      ]);
      fallback = [...used, ...news];
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 lg:py-16">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.22em] font-bold text-brand-red mb-3">
          Search
        </p>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-6">
          What are you looking for?
        </h1>
        <form
          method="get"
          action="/search"
          role="search"
          className="flex gap-3 max-w-2xl"
        >
          <input
            type="search"
            name="q"
            defaultValue={query}
            autoFocus={!hasQuery}
            aria-label="Search products"
            placeholder="Try Aeron, sit-stand, Herman Miller..."
            maxLength={100}
            className="flex-1 border border-rule bg-paper px-4 py-3 text-base focus:outline-none focus:border-ink transition-colors"
          />
          {brandSlugs.length > 0 && (
            // Preserve the brand filter across submissions so a buyer
            // can refine within the same filter set.
            <input type="hidden" name="brands" value={brandSlugs.join(",")} />
          )}
          <button
            type="submit"
            className="bg-ink text-paper px-4 py-3 text-xs uppercase tracking-[0.22em] font-bold hover:bg-brand-red transition-colors sm:px-6"
          >
            Search
          </button>
        </form>
      </header>

      {brandOptions.length > 0 && (
        <div className="mb-8">
          <FilterChips
            mode="brand"
            options={brandOptions}
            selected={brandSlugs}
          />
        </div>
      )}

      {!hasQuery && (
        <div className="border border-rule py-16 px-6 text-center">
          <p className="text-xs uppercase tracking-[0.22em] font-bold text-ink/40">
            Type a brand, model, or feature to search the catalogue.
          </p>
        </div>
      )}

      {hasQuery && results.length > 0 && (
        <>
          <p className="text-xs uppercase tracking-[0.22em] font-bold text-ink/60 mb-6">
            {results.length} {results.length === 1 ? "result" : "results"}{" "}
            for &ldquo;{query}&rdquo;
          </p>
          <ListingGrid products={results} />
        </>
      )}

      {hasQuery && results.length === 0 && (
        <>
          <div className="border border-rule py-10 px-6 text-center mb-12">
            <p className="text-xs uppercase tracking-[0.22em] font-bold text-ink/60 mb-3">
              No results for &ldquo;{query}&rdquo;
            </p>
            <p className="text-sm text-ink/60">
              Browse the catalogue below, or refine your search above.
            </p>
          </div>
          {fallback.length > 0 && (
            <>
              <p className="text-xs uppercase tracking-[0.22em] font-bold text-ink/60 mb-6">
                Browse the catalogue
              </p>
              <ListingGrid products={fallback} />
            </>
          )}
        </>
      )}
    </main>
  );
}
