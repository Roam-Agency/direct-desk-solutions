import { Metadata } from "next";
import Breadcrumb from "@/app/(public)/_Breadcrumb";
import ListingGrid from "../_ListingGrid";
import SortDropdown from "../_SortDropdown";
import {
  listLiveProducts,
  DEFAULT_LISTING_SORT,
  type ListingSort,
} from "@/lib/products/fetch";

export const metadata: Metadata = {
  title: "New Office Furniture | Direct Desk Solutions",
  description: "Quality new desks, chairs, storage and meeting room furniture, delivered across the UK.",
};

const VALID_SORTS: ListingSort[] = ["price-asc", "price-desc", "newest"];

function parseSort(raw: string | string[] | undefined): ListingSort {
  if (typeof raw === "string" && (VALID_SORTS as string[]).includes(raw)) {
    return raw as ListingSort;
  }
  return DEFAULT_LISTING_SORT;
}

export default async function NewProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const sp = await searchParams;
  const sort = parseSort(sp.sort);
  const products = await listLiveProducts({ condition: "new", sortBy: sort });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 sm:py-12">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/products" },
          { label: "New" },
        ]}
      />

      <header className="mt-8 mb-10 sm:mb-12">
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-ink mb-3">
          New Office Furniture
        </h1>
        <p className="text-sm sm:text-base text-ink/70 max-w-xl leading-relaxed">
          Quality new desks, chairs, storage and meeting room furniture, delivered across the UK.
        </p>
      </header>

      <div className="flex items-center justify-between mb-6 sm:mb-8 pb-4 border-b border-rule">
        <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink/60">
          {products.length} {products.length === 1 ? "item" : "items"}
        </p>
        <SortDropdown current={sort} />
      </div>

      <ListingGrid
        products={products}
        emptyMessage="No new stock right now \u2014 check back soon"
      />
    </div>
  );
}
