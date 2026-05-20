import { Metadata } from "next";
import Breadcrumb from "@/app/(public)/_Breadcrumb";
import BrandTile from "./_BrandTile";
import { listBrandsWithCounts } from "@/lib/products/fetch";

export const metadata: Metadata = {
  title: "Brands | Direct Desk Solutions",
  description:
    "The premium furniture brands we work with — Herman Miller, Steelcase, Vitra. New stock and curated refurbished items, every used piece with a full condition report.",
};

export default async function BrandsIndexPage() {
  const brands = await listBrandsWithCounts();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 sm:py-12">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Brands" },
        ]}
      />

      <header className="mt-8 mb-10 sm:mb-12">
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-ink mb-3">
          Brands
        </h1>
        <p className="text-sm sm:text-base text-ink/70 max-w-xl leading-relaxed">
          The premium furniture brands we work with. New stock when we have it,
          curated refurbished items at trade-clearance prices — every used
          piece with a full condition report.
        </p>
      </header>

      {brands.length === 0 ? (
        <div className="border border-rule py-16 px-6 text-center">
          <p className="text-xs uppercase tracking-[0.22em] font-bold text-ink/40">
            No brands yet
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {brands.map((b) => (
            <BrandTile
              key={b.id}
              slug={b.slug}
              name={b.name}
              count={b.live_product_count}
            />
          ))}
        </div>
      )}
    </div>
  );
}
