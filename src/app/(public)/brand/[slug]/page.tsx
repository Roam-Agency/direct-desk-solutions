import { Metadata } from "next";
import { notFound } from "next/navigation";
import Breadcrumb from "@/app/(public)/_Breadcrumb";
import ListingGrid from "@/app/(public)/products/_ListingGrid";
import SortDropdown from "@/app/(public)/products/_SortDropdown";
import { listLiveProductsByBrandSlug } from "@/lib/products/fetch";
import {
  DEFAULT_LISTING_SORT,
  type ListingSort,
} from "@/lib/products/listing-sort";

const VALID_SORTS: ListingSort[] = ["price-asc", "price-desc", "newest"];

function parseSort(raw: string | string[] | undefined): ListingSort {
  if (typeof raw === "string" && (VALID_SORTS as string[]).includes(raw)) {
    return raw as ListingSort;
  }
  return DEFAULT_LISTING_SORT;
}

/**
 * Per-route metadata. Renders the brand name in the page title; falls
 * back to a generic title if the slug doesn't resolve (the page will
 * notFound() inside the component anyway, so this is mostly defensive).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await listLiveProductsByBrandSlug({ brandSlug: slug });
  if (!result) {
    return { title: "Brand | Direct Desk Solutions" };
  }
  return {
    title: `${result.brand.name} | Direct Desk Solutions`,
    description: `${result.brand.name} furniture — new stock and curated refurbished items at Direct Desk Solutions.`,
  };
}

export default async function BrandLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const sort = parseSort(sp.sort);

  const result = await listLiveProductsByBrandSlug({
    brandSlug: slug,
    sortBy: sort,
  });

  // No active brand category at this slug — 404.
  if (!result) {
    notFound();
  }

  const { brand, products } = result;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 sm:py-12 lg:py-16">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Brands", href: "/brands" },
          { label: brand.name },
        ]}
      />

      <header className="mt-8 mb-10 sm:mb-12">
        {/* Wordmark — Archivo Black at scale, the visual atom that
            differentiates brand landings from generic category pages. */}
        <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink/60 mb-3">
          Brand
        </p>
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-ink leading-[0.95] uppercase">
          {brand.name}
        </h1>
      </header>

      <div className="flex items-center justify-between mb-6 sm:mb-8 pb-4 border-b border-rule">
        <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink/60">
          {products.length} {products.length === 1 ? "item" : "items"}
        </p>
        <SortDropdown current={sort} />
      </div>

      <ListingGrid
        products={products}
        emptyMessage={`No ${brand.name} stock right now \u2014 check back soon`}
      />
    </div>
  );
}
