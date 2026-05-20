import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/app/(public)/_Breadcrumb";

export const metadata: Metadata = {
  title: "How We Refurbish | Direct Desk Solutions",
  description:
    "Our refurbishment process — sourcing, inspection, mechanical service, condition reporting, and the 3-month warranty. The Darlington workshop, the bar, the receipts.",
};

export default function HowWeRefurbishPage() {
  return (
    <>
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:py-24">
          <p className="text-xs uppercase tracking-[0.22em] font-bold text-brand-red mb-4">
            How we refurbish
          </p>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[0.95] max-w-4xl">
            The workshop,
            <br />
            the bar, the receipts.
          </h1>
          <p className="mt-6 max-w-2xl text-base sm:text-lg text-paper/70 leading-relaxed">
            Every refurbished item passes through the same process in
            our Darlington workshop. Source, inspect, service, document,
            ship. Here is what happens at each step — and what we
            guarantee at the end of it.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
        <div className="mx-auto max-w-3xl">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "How we refurbish" },
            ]}
          />

          <div className="mt-12 space-y-16">
            <article>
              <p className="text-xs uppercase tracking-[0.22em] font-bold text-brand-red mb-3">
                The workshop
              </p>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-5">
                Darlington, North East England.
              </h2>
              {/* TODO(copy): workshop specifics — team size, square
                  footage, tools/equipment worth name-checking, photos.
                  Currently a generic but accurate one-liner. */}
              <p className="text-base text-ink/80 leading-relaxed">
                We operate from a workshop in Darlington with the
                space, tooling and stock to strip, service and rebuild
                premium task chairs and desk systems to the standard
                their original manufacturers set. Every item is
                handled in-house — nothing is contracted out.
              </p>
            </article>

            <article>
              <p className="text-xs uppercase tracking-[0.22em] font-bold text-brand-red mb-3">
                The process
              </p>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-5">
                Five stages, no shortcuts.
              </h2>
              {/* TODO(copy): the precise refurb steps — replace this
                  five-stage sketch with Andy's actual workshop SOP.
                  Currently a credible but generic sequence. */}
              <div className="space-y-6">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-ink mb-2">
                    01 / Source
                  </p>
                  <p className="text-base text-ink/80 leading-relaxed">
                    Stock comes from UK corporate clearances —
                    refurbishments, relocations, downsizes. Each
                    consignment is inspected on arrival; anything that
                    can&rsquo;t be brought to standard is rejected
                    before it enters the workshop.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-ink mb-2">
                    02 / Inspect
                  </p>
                  <p className="text-base text-ink/80 leading-relaxed">
                    Mechanical inspection against the manufacturer&rsquo;s
                    original spec. Frame, tilt mechanism, gas lift,
                    armrests, mesh tension, castors. Any failure point
                    is logged.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-ink mb-2">
                    03 / Service
                  </p>
                  <p className="text-base text-ink/80 leading-relaxed">
                    Strip-down, deep clean, consumable replacement
                    (mesh, castors, gas lifts where indicated),
                    re-grease, reassemble. Genuine manufacturer parts
                    where available; equivalents only where they
                    aren&rsquo;t.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-ink mb-2">
                    04 / Document
                  </p>
                  <p className="text-base text-ink/80 leading-relaxed">
                    Photographed individually under workshop lighting.
                    Any remaining cosmetic marks (scuffs, fading,
                    surface wear) are noted in a per-item condition
                    report — the same report the buyer sees on the
                    product page.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-ink mb-2">
                    05 / Ship
                  </p>
                  <p className="text-base text-ink/80 leading-relaxed">
                    Packed for transit and delivered UK-wide. The
                    warranty starts the day it arrives.
                  </p>
                </div>
              </div>
            </article>

            <article>
              <p className="text-xs uppercase tracking-[0.22em] font-bold text-brand-red mb-3">
                Condition reports
              </p>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-5">
                Every refurbished item.
              </h2>
              <p className="text-base text-ink/80 leading-relaxed mb-4">
                A condition report is a per-item record of what the
                buyer is actually getting. Mechanical condition,
                cosmetic notes, source provenance, refurb date.
                Tied to photographs of the actual unit — not stock
                images, not a representative example.
              </p>
              <p className="text-base text-ink/80 leading-relaxed">
                If a chair has a scuff on the base, the report says
                so and the photo shows it. If everything is
                showroom-fresh, the report says that too. The point
                is to remove the surprise.
              </p>
            </article>

            <article id="warranty">
              <p className="text-xs uppercase tracking-[0.22em] font-bold text-brand-red mb-3">
                Warranty
              </p>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-5">
                3 months, mechanical.
              </h2>
              {/* TODO(copy): the exact warranty terms — what's
                  covered, what isn't, the claim process. The
                  three-month and mechanical-failure summary below is
                  the headline; the fine print needs to be Andy's
                  actual policy. */}
              <p className="text-base text-ink/80 leading-relaxed mb-4">
                Every refurbished item is covered for 3 months from
                delivery against mechanical failure — anything in
                the service checklist that fails inside that window
                is our responsibility to fix or replace.
              </p>
              <p className="text-base text-ink/80 leading-relaxed">
                Cosmetic wear that was disclosed on the condition
                report isn&rsquo;t covered (it&rsquo;s already on the
                receipt). Anything not disclosed is.
              </p>
            </article>

            {/* CTA */}
            <div className="border-t border-rule pt-12">
              <p className="text-xs uppercase tracking-[0.22em] font-bold text-ink/60 mb-4">
                See it in practice
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/products/used"
                  className="inline-block bg-ink text-paper px-6 py-3 text-xs uppercase tracking-[0.22em] font-bold hover:bg-brand-red transition-colors text-center"
                >
                  Browse refurbished
                </Link>
                <Link
                  href="/why-used"
                  className="inline-block border-2 border-ink text-ink px-6 py-3 text-xs uppercase tracking-[0.22em] font-bold hover:bg-ink hover:text-paper transition-colors text-center"
                >
                  Why used?
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
