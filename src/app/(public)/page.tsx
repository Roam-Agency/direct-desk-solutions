import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SplitTile from "./products/_SplitTile";
import BrandTile from "./brands/_BrandTile";
import {
  countLiveProductsByCondition,
  listBrandsWithCounts,
} from "@/lib/products/fetch";

// BRIEF_12_SESSION_6_MARKER — homepage redesign, Phase 3 P0.

export const metadata: Metadata = {
  title: "Direct Desk Solutions — Office furniture, honestly described",
  description:
    "New and refurbished premium office furniture — Herman Miller, Steelcase, Vitra. Every used piece comes with a full condition report. Delivered across the UK.",
};

export default async function PublicHomePage() {
  // Fetch in parallel — both helpers hit Supabase independently.
  const [counts, brands] = await Promise.all([
    countLiveProductsByCondition(),
    listBrandsWithCounts(),
  ]);

  return (
    <>
      {/* ===== 1. Hero — black editorial banner ===== */}
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28 lg:py-36">
          <p className="text-[10px] uppercase tracking-[0.28em] text-brand-red font-bold mb-6">
            Direct Desk Solutions
          </p>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[0.95] mb-8 max-w-4xl">
            Office furniture,
            <br />
            honestly described.
          </h1>
          <p className="text-base sm:text-lg text-paper/70 leading-relaxed mb-10 max-w-xl">
            A curated catalogue of refurbished premium chairs and desks — Herman Miller, Steelcase, Vitra. Professionally restored in our UK workshop, every piece sold with a full condition report so you know exactly what you&apos;re buying. New stock available too.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 sm:items-center">
            <Link
              href="/products/used"
              className="inline-flex items-center justify-center bg-paper text-ink px-8 py-4 text-xs uppercase tracking-[0.18em] font-bold hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 focus:ring-offset-ink"
            >
              Shop used
            </Link>
            <Link
              href="/products/new"
              className="inline-flex items-center text-xs uppercase tracking-[0.18em] font-bold border-b-2 border-paper pb-1 hover:opacity-70 transition-opacity self-start sm:self-auto"
            >
              Shop new →
            </Link>
          </div>
        </div>
      </section>

      {/* ===== 2. Shop New / Shop Used split tiles ===== */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
        <div className="mb-10 lg:mb-14">
          <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink/60 mb-3">
            Browse
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[0.95]">
            What are you looking for?
          </h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2">
            <SplitTile
              href="/products/used"
              eyebrow="The DDS difference"
              title="Shop Used"
              blurb="Premium pre-owned chairs and desks from Herman Miller, Steelcase, Vitra. Professionally refurbished in our UK workshop, every piece with a full condition report. Trade-clearance prices on furniture built to last decades."
              count={counts.used}
              accent="red"
            />
          </div>
          <div className="lg:col-span-1">
            <SplitTile
              href="/products/new"
              eyebrow="Also available"
              title="Shop New"
              blurb="Desks, chairs, storage and meeting room furniture. Full manufacturer warranty, UK delivery, easy returns."
              count={counts.new}
              accent="none"
            />
          </div>
        </div>
      </section>

      {/* ===== 3. Brand shortcuts ===== */}
      {brands.length > 0 && (
        <section className="bg-paper border-t border-rule">
          <div className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
            <div className="mb-10 lg:mb-14 flex items-end justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink/60 mb-3">
                  Brands
                </p>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[0.95]">
                  Premium, refurbished.
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {brands.map((b) => (
                <BrandTile
                  key={b.id}
                  slug={b.slug}
                  name={b.name}
                  count={b.live_product_count}
                  backgroundImage="/decor/office-mono.jpg"
                />
              ))}
            </div>
            <div className="mt-10 lg:mt-12">
              <Link
                href="/brands"
                className="inline-flex items-center text-xs uppercase tracking-[0.18em] font-bold border-b-2 border-ink pb-1 hover:opacity-70 transition-opacity"
              >
                View all brands →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ===== 4. Why DDS trust trio — dark band, bookends the hero ===== */}
      <section className="relative bg-ink text-paper overflow-hidden">
        {/* Decorative loft backdrop, heavily darkened so text stays legible */}
        <Image
          src="/decor/office-loft.jpg"
          alt=""
          aria-hidden="true"
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-ink/85" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 lg:py-24">
          <div className="mb-10 lg:mb-14">
            <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-paper/60 mb-3">
              Why Direct Desk
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[0.95]">
              Built on trust, not markup.
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12">
            <div>
              <div className="h-0.5 w-10 bg-brand-red mb-5" aria-hidden="true" />
              <h3 className="text-lg font-black tracking-tight mb-3">
                UK workshop refurb
              </h3>
              <p className="text-sm text-paper/70 leading-relaxed">
                Every used piece is professionally restored in our workshop before it&apos;s listed. We don&apos;t resell what we wouldn&apos;t use ourselves.
              </p>
            </div>
            <div>
              <div className="h-0.5 w-10 bg-brand-red mb-5" aria-hidden="true" />
              <h3 className="text-lg font-black tracking-tight mb-3">
                Full condition reports
              </h3>
              <p className="text-sm text-paper/70 leading-relaxed">
                Photos, grades, and itemised observations on every refurbished item. What you see is what arrives.
              </p>
            </div>
            <div>
              <div className="h-0.5 w-10 bg-brand-red mb-5" aria-hidden="true" />
              <h3 className="text-lg font-black tracking-tight mb-3">
                Warranty on everything
              </h3>
              <p className="text-sm text-paper/70 leading-relaxed">
                12-month warranty on new, 3-month on refurbished. Returns accepted within 14 days. UK delivery on every order.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
