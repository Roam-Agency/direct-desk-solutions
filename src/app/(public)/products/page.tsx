import { Metadata } from "next";
import Breadcrumb from "@/app/(public)/_Breadcrumb";
import SplitTile from "./_SplitTile";
import { countLiveProductsByCondition } from "@/lib/products/fetch";

export const metadata: Metadata = {
  title: "Shop | Direct Desk Solutions",
  description:
    "New and pre-owned office furniture, delivered across the UK. Choose new for clean lines and fresh warranty, or used for premium brands at trade-clearance prices.",
};

export default async function ShopLandingPage() {
  const counts = await countLiveProductsByCondition();

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 sm:py-12 lg:py-16">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Shop" },
        ]}
      />

      <header className="mt-8 mb-10 sm:mb-14 max-w-2xl">
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-ink mb-4 leading-[0.95]">
          What are you looking for?
        </h1>
        <p className="text-sm sm:text-base text-ink/70 leading-relaxed">
          We sell both new office furniture and a curated catalogue of
          premium pre-owned pieces. Pick a side to start browsing.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <SplitTile
          href="/products/new"
          eyebrow="Browse"
          title="Shop New"
          blurb="Desks, chairs, storage and meeting room furniture. Full manufacturer warranty, UK delivery, easy returns."
          count={counts.new}
        />
        <SplitTile
          href="/products/used"
          eyebrow="Browse"
          title="Shop Used"
          blurb="Premium pre-owned chairs and desks from Herman Miller, Steelcase, Vitra. Professionally refurbished with full condition reports."
          count={counts.used}
          accent="red"
        />
      </div>
    </div>
  );
}
