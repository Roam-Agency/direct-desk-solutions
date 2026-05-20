import type { Metadata } from "next";
import Breadcrumb from "@/app/(public)/_Breadcrumb";

export const metadata: Metadata = {
  title: "About | Direct Desk Solutions",
  description:
    "Direct Desk Solutions Ltd — a Darlington-based office furniture company supplying new stock and curated, refurbished premium pre-owned items UK-wide.",
};

export default function AboutPage() {
  return (
    <>
      {/* Hero — black editorial band, matches /search and the homepage. */}
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:py-24">
          <p className="text-xs uppercase tracking-[0.22em] font-bold text-brand-red mb-4">
            About
          </p>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[0.95] max-w-4xl">
            Office furniture,
            <br />
            honestly described.
          </h1>
          <p className="mt-6 max-w-2xl text-base sm:text-lg text-paper/70 leading-relaxed">
            Direct Desk Solutions Ltd is a Darlington-based office furniture
            company. We supply new stock and a curated catalogue of
            refurbished premium pre-owned items — Herman Miller, Steelcase,
            Vitra and others — delivered across the UK.
          </p>
        </div>
      </section>

      {/* Paper body, three sections at standard reading width. */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
        <div className="mx-auto max-w-3xl">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "About" },
            ]}
          />

          <div className="mt-12 space-y-16">
            <article>
              <p className="text-xs uppercase tracking-[0.22em] font-bold text-brand-red mb-3">
                Who we are
              </p>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-5">
                A small team, a clear remit.
              </h2>
              {/* TODO(copy): William Birch founder story — year founded,
                  background before DDS, why he started the company.
                  Currently a placeholder framing. */}
              <p className="text-base text-ink/80 leading-relaxed mb-4">
                Direct Desk Solutions was founded by William Birch to do
                one thing properly: source, refurbish and supply premium
                office furniture without the markup or mystery that comes
                with the bigger generic dealers.
              </p>
              <p className="text-base text-ink/80 leading-relaxed">
                We operate from a workshop in Darlington, North East
                England, and deliver UK-wide.
              </p>
            </article>

            <article>
              <p className="text-xs uppercase tracking-[0.22em] font-bold text-brand-red mb-3">
                The catalogue
              </p>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-5">
                Two sides, one bar.
              </h2>
              <p className="text-base text-ink/80 leading-relaxed mb-4">
                New stock for the buyer kitting out a fresh space — desks,
                task chairs, storage, meeting tables, acoustic booths.
                Pre-owned for the buyer who wants a Herman Miller Aeron or
                a Steelcase Think for the price of a generic mesh chair.
              </p>
              <p className="text-base text-ink/80 leading-relaxed">
                Every refurbished item is professionally inspected,
                serviced and photographed in our Darlington workshop, then
                listed with a full condition report so you can see exactly
                what you{"'"}re buying before it ships.
              </p>
            </article>

            <article>
              <p className="text-xs uppercase tracking-[0.22em] font-bold text-brand-red mb-3">
                Why pre-owned matters
              </p>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-5">
                The premium chair already exists.
              </h2>
              <p className="text-base text-ink/80 leading-relaxed mb-4">
                A Herman Miller Aeron is built to last twenty-plus years.
                Most spend their first life in a corporate office and end
                their service when the company refurbishes, relocates, or
                downsizes. The chair isn{"'"}t worn out — the lease just
                ended.
              </p>
              <p className="text-base text-ink/80 leading-relaxed">
                We source these clearances, refurbish them properly, and
                pass on the price difference. A new Aeron is £1,495 RRP.
                Ours start at £645. The buyer gets the chair they
                actually want; the chair stays out of landfill.
              </p>
            </article>

            <article>
              <p className="text-xs uppercase tracking-[0.22em] font-bold text-brand-red mb-3">
                Get in touch
              </p>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-5">
                Talk to us.
              </h2>
              <p className="text-base text-ink/80 leading-relaxed mb-4">
                Office fit-out, trade enquiries, sourcing requests for
                specific models, planning a delivery to your floor:
                {" "}
                <a
                  href="mailto:info@directdesksolutions.com"
                  className="font-bold border-b-2 border-ink hover:text-brand-red hover:border-brand-red transition-colors"
                >
                  info@directdesksolutions.com
                </a>
                .
              </p>
              {/* TODO(copy): trade enquiries — bulk discount tiers,
                  invoice terms, account opening process. Mention here
                  once defined. */}
              <p className="text-base text-ink/80 leading-relaxed">
                UK-wide delivery. We&rsquo;ll respond within one working day.
              </p>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
