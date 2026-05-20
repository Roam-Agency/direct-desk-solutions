import type { Metadata } from "next";
import {
  searchProducts,
  listLiveProducts,
  type ProductCard,
} from "@/lib/products/fetch";
import ListingGrid from "../products/_ListingGrid";

export const metadata: Metadata = {
  title: "Search",
  description:
    "Search the Direct Desk Solutions catalogue — new and refurbished office furniture.",
};

// Next.js 16 routes receive searchParams as a Promise.
type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q: rawQuery } = await searchParams;
  const query = (rawQuery ?? "").trim();
  const hasQuery = query.length > 0;

  // Only hit the DB when there's a query. Empty state is a prompt, not
  // a catalogue dump — the buyer expects to type something first.
  let results: ProductCard[] = [];
  let fallback: ProductCard[] = [];

  if (hasQuery) {
    results = await searchProducts({ query });

    // Zero-results gets a "here is the catalogue" fallback so the
    // buyer isn't dead-ended. Two queries, concatenated, sorted by the
    // default ordering. Only paid when results are empty.
    if (results.length === 0) {
      const [used, news] = await Promise.all([
        listLiveProducts({ condition: "used" }),
        listLiveProducts({ condition: "new" }),
      ]);
      // Interleave used + new with used first — used is the
      // differentiator and the higher-intent surface.
      fallback = [...used, ...news];
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 lg:py-16">
      {/* Page header + search input. Real <form> with method=get so the
          browser handles submission without JS. */}
      <header className="mb-10">
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
          <button
            type="submit"
            className="bg-ink text-paper px-6 py-3 text-xs uppercase tracking-[0.22em] font-bold hover:bg-brand-red transition-colors"
          >
            Search
          </button>
        </form>
      </header>

      {/* Three render states below. */}

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
