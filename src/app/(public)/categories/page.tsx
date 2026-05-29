import { Metadata } from "next";
import Breadcrumb from "@/app/(public)/_Breadcrumb";
import CategoryTile from "./_CategoryTile";
import { listFunctionalCategoriesWithCounts } from "@/lib/products/fetch";

export const metadata: Metadata = {
  title: "Categories | Direct Desk Solutions",
  description:
    "Browse our office furniture by type — desks, seating, storage, meeting tables and more. New stock and curated refurbished items, every used piece with a full condition report.",
};

export default async function CategoriesIndexPage() {
  const categories = await listFunctionalCategoriesWithCounts();

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 sm:py-12 lg:py-16">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Categories" },
        ]}
      />

      <header className="mt-8 mb-10 sm:mb-12">
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-ink mb-3">
          Categories
        </h1>
        <p className="text-sm sm:text-base text-ink/70 max-w-xl leading-relaxed">
          Browse by type of furniture. New stock when we have it, curated
          refurbished items at trade-clearance prices — every used piece with
          a full condition report.
        </p>
      </header>

      {categories.length === 0 ? (
        <div className="border border-rule py-16 px-6 text-center">
          <p className="text-xs uppercase tracking-[0.22em] font-bold text-ink/40">
            No categories yet
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {categories.map((c, i) => (
            <CategoryTile
              key={c.id}
              slug={c.slug}
              name={c.name}
              count={c.live_product_count}
              imageIndex={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}
