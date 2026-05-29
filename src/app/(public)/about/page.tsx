import type { Metadata } from "next";
import Breadcrumb from "@/app/(public)/_Breadcrumb";

export const metadata: Metadata = {
  title: "About | Direct Desk Solutions",
  description:
    "A Darlington-based office furniture company. Quality new stock and properly refurbished pre-owned pieces, honestly described and delivered UK-wide.",
  openGraph: {
    title: "About | Direct Desk Solutions",
    description:
      "A Darlington-based office furniture company. Quality new stock and properly refurbished pre-owned pieces, honestly described and delivered UK-wide.",
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
    title: "About | Direct Desk Solutions",
    description:
      "A Darlington-based office furniture company. Quality new stock and properly refurbished pre-owned pieces, honestly described and delivered UK-wide.",
    images: ["/og-default.png"],
  },
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
            A Darlington-based office furniture company. We supply quality
            new stock and a catalogue of properly refurbished pre-owned
            pieces — every one honestly described and delivered across the
            UK.
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
                one thing properly: source, refurbish and supply good
                office furniture — new or pre-owned — without the markup
                or the mystery you get from the bigger dealers.
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
                Pre-owned for the buyer who wants a properly built chair
                or desk for a fraction of the price of equivalent new.
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
                The good stuff already exists.
              </h2>
              <p className="text-base text-ink/80 leading-relaxed mb-4">
                A well-made task chair or desk is built to last decades.
                Most spend their first life in a corporate office and end
                their service when the company refurbishes, relocates, or
                downsizes. The furniture isn{"'"}t worn out — the lease
                just ended.
              </p>
              <p className="text-base text-ink/80 leading-relaxed">
                We source these clearances, refurbish them properly, and
                pass the saving on — quality pieces for a fraction of the
                price of equivalent new. You get furniture that actually
                lasts; it stays out of landfill. Everyone wins but the
                skip.
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
                Free UK mainland delivery, and a real person on the other
                end — we&rsquo;ll get back to you within one working day.
              </p>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
