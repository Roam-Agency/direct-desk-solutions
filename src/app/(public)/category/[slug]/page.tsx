import { Metadata } from "next";
import { notFound } from "next/navigation";
import Breadcrumb from "@/app/(public)/_Breadcrumb";
import ListingGrid from "@/app/(public)/products/_ListingGrid";
import SortDropdown from "@/app/(public)/products/_SortDropdown";
import FilterChips from "@/app/(public)/products/_FilterChips";
import { listLiveProductsByCategorySlug } from "@/lib/products/fetch";
import {
  DEFAULT_LISTING_SORT,
  type ListingSort,
} from "@/lib/products/listing-sort";
import {
  parseConditionFilter,
  CONDITION_FILTERS,
} from "@/lib/products/listing-filters";

const VALID_SORTS: ListingSort[] = ["price-asc", "price-desc", "newest"];

function parseSort(raw: string | string[] | undefined): ListingSort {
  if (typeof raw === "string" && (VALID_SORTS as string[]).includes(raw)) {
    return raw as ListingSort;
  }
  return DEFAULT_LISTING_SORT;
}

/**
 * Per-route metadata. Renders the category name in the page title; falls
 * back to a generic title if the slug doesn't resolve (the page will
 * notFound() inside the component anyway, so this is mostly defensive).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await listLiveProductsByCategorySlug({ categorySlug: slug });
  if (!result) {
    return { title: "Category | Direct Desk Solutions" };
  }
  return {
    title: `${result.category.name} | Direct Desk Solutions`,
    description: `${result.category.name} — new stock and curated refurbished items at Direct Desk Solutions.`,
  };
}

export default async function CategoryLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; condition?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const sort = parseSort(sp.sort);
  const condition = parseConditionFilter(sp.condition);

  const result = await listLiveProductsByCategorySlug({
    categorySlug: slug,
    sortBy: sort,
    condition: condition === "all" ? undefined : condition,
  });

  // No active functional category at this slug — 404.
  if (!result) {
    notFound();
  }

  const { category, products } = result;

  // Filter the CONDITION_FILTERS to drop the implicit "all" — selected=null
  // already represents "all", so showing it as a chip is redundant noise.
  const conditionOptions = CONDITION_FILTERS.filter((c) => c.value !== "all");

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 sm:py-12 lg:py-16">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Categories", href: "/categories" },
          { label: category.name },
        ]}
      />

      <header className="mt-8 mb-10 sm:mb-12">
        <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink/60 mb-3">
          Category
        </p>
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-ink leading-[0.95]">
          {category.name}
        </h1>
      </header>

      <div className="mb-4 sm:mb-6">
        <FilterChips
          mode="condition"
          options={conditionOptions}
          selected={condition === "all" ? null : condition}
        />
      </div>

      <div className="flex items-center justify-between mb-6 sm:mb-8 pb-4 border-b border-rule">
        <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink/60">
          {products.length} {products.length === 1 ? "item" : "items"}
        </p>
        <SortDropdown current={sort} />
      </div>

      <ListingGrid
        products={products}
        emptyMessage={`No ${category.name} stock right now — check back soon`}
      />
    </div>
  );
}
