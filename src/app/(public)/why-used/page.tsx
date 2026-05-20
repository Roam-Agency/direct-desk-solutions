import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/app/(public)/_Breadcrumb";

export const metadata: Metadata = {
  title: "Why Used? | Direct Desk Solutions",
  description:
    "A refurbished Herman Miller Aeron at £645 outperforms a new £200 mesh chair on every measure that matters. Here is why pre-owned premium beats new generic — and how we de-risk it for the buyer.",
  openGraph: {
    title: "Why Used? | Direct Desk Solutions",
    description:
      "A refurbished Herman Miller Aeron at £645 outperforms a new £200 mesh chair on every measure that matters. Here is why pre-owned premium beats new generic — and how we de-risk it for the buyer.",
    type: "website",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "Direct Desk Solutions",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Why Used? | Direct Desk Solutions",
    description:
      "A refurbished Herman Miller Aeron at £645 outperforms a new £200 mesh chair on every measure that matters. Here is why pre-owned premium beats new generic — and how we de-risk it for the buyer.",
    images: ["/og-default.png"],
  },
};

export default function WhyUsedPage() {
  return (
    <>
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:py-24">
          <p className="text-xs uppercase tracking-[0.22em] font-bold text-brand-red mb-4">
            Why used?
          </p>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[0.95] max-w-4xl">
            The £1,495 chair,
            <br />
            refurbished.
          </h1>
          <p className="mt-6 max-w-2xl text-base sm:text-lg text-paper/70 leading-relaxed">
            A new Herman Miller Aeron is £1,495 RRP. Ours start at £645.
            Same chair, professionally refurbished, with a full condition
            report and a 3-month warranty. Here&rsquo;s how that maths
            actually works.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
        <div className="mx-auto max-w-3xl">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Why used?" },
            ]}
          />

          <div className="mt-12 space-y-16">
            <article>
              <p className="text-xs uppercase tracking-[0.22em] font-bold text-brand-red mb-3">
                The economics
              </p>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-5">
                A 10-year-old Aeron beats a new £200 chair.
              </h2>
              <p className="text-base text-ink/80 leading-relaxed mb-4">
                The buyer with a £700 budget has two real options. Buy a
                new generic mesh task chair around £200 to £400 — built
                to a price point, mostly to look like an office chair.
                Or buy a refurbished Aeron. The Aeron was engineered
                for an eight-hour day, originally retailed for
                £1,495, and is built to last twenty years.
              </p>
              <p className="text-base text-ink/80 leading-relaxed">
                Ten years into its life it is, mechanically, the same
                chair. Stronger mesh than the £200 chair, better lumbar,
                proper tilt control, and parts that can still be replaced
                from the manufacturer because Herman Miller still sells
                them.
              </p>
            </article>

            <article>
              <p className="text-xs uppercase tracking-[0.22em] font-bold text-brand-red mb-3">
                What &ldquo;refurbished&rdquo; means here
              </p>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-5">
                A specific list, not a vague claim.
              </h2>
              {/* TODO(copy): the exact refurb checklist — replace this
                  generic version with Andy's actual workshop steps.
                  Currently a credible but generic sequence. */}
              <p className="text-base text-ink/80 leading-relaxed mb-4">
                Every refurbished item passes through the same workshop
                process in Darlington: deep clean, mechanical service,
                replacement of consumable parts where needed (mesh,
                castors, gas lifts), full functional test under load,
                and a photographic record of any cosmetic marks that
                remain.
              </p>
              <p className="text-base text-ink/80 leading-relaxed">
                The result is documented in a per-item condition report
                you can read{" "}
                <Link
                  href="/products/used"
                  className="font-bold border-b-2 border-ink hover:text-brand-red hover:border-brand-red transition-colors"
                >
                  before you buy
                </Link>
                . That report is the contract.
              </p>
            </article>

            <article>
              <p className="text-xs uppercase tracking-[0.22em] font-bold text-brand-red mb-3">
                How we de-risk it
              </p>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-5">
                Trade-clearance prices, without the trade-clearance risk.
              </h2>
              <p className="text-base text-ink/80 leading-relaxed mb-4">
                The reason most buyers don&rsquo;t buy refurbished is that
                the marketplaces are a coin-flip. Generic listings, no
                pictures of the actual item, no recourse if the chair
                arrives broken. We replace all three.
              </p>
              <p className="text-base text-ink/80 leading-relaxed mb-4">
                Every item is photographed individually, professionally
                refurbished against a published checklist, and shipped
                with a 3-month warranty against mechanical failure.
                Delivery is UK-wide.
              </p>
              <p className="text-base text-ink/80 leading-relaxed">
                The condition report tells you exactly what condition
                you&rsquo;re buying. If something fails inside the
                warranty window, we fix it or replace the item. That
                is the difference between us and the marketplaces.
              </p>
            </article>

            {/* CTA back to the catalogue */}
            <div className="border-t border-rule pt-12">
              <p className="text-xs uppercase tracking-[0.22em] font-bold text-ink/60 mb-4">
                Ready to browse?
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/products/used"
                  className="inline-block bg-ink text-paper px-6 py-3 text-xs uppercase tracking-[0.22em] font-bold hover:bg-brand-red transition-colors text-center"
                >
                  Shop Used
                </Link>
                <Link
                  href="/how-we-refurbish"
                  className="inline-block border-2 border-ink text-ink px-6 py-3 text-xs uppercase tracking-[0.22em] font-bold hover:bg-ink hover:text-paper transition-colors text-center"
                >
                  How we refurbish
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
