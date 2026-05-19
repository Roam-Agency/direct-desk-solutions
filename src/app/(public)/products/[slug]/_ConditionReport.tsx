import Image from "next/image";
import type { PublishedConditionReport } from "@/lib/products/fetch";
import ConditionBadge from "./_ConditionBadge";

/**
 * Buyer-side condition report render.
 *
 * Renders the full structure of a published condition report:
 *
 *   1. Report header — small "Condition report" eyebrow, large grade
 *      badge alongside a two-line summary describing overall condition.
 *
 *   2. Observations heading — gramatically-correct pluralised count
 *      ("Observation · 1" / "Observations · 2") to make clear this is
 *      itemised honesty, not a vague trust claim.
 *
 *   3. Observation list — each item shows:
 *        - Severity label (red ink for moderate/significant, neutral
 *          for light/faultless — the colour does the work, no dot)
 *        - Area name
 *        - Description body
 *        - Optional image at 16:10 with the image's alt_text as a
 *          captioned aria-label
 *
 * Only renders when getPublishedConditionReport() returned non-null;
 * the page.tsx caller is responsible for that gate. This component
 * assumes a real, published report with at least one item.
 *
 * No duplication with the trust bullets above the description on the
 * page — those carry the high-level brand promises (Workshop / Warranty
 * / Provenance). This component carries the itemised, photographable
 * record of what was actually found.
 */

type Props = {
  report: PublishedConditionReport;
  productCondition: "new" | "used";
  productName: string;
};

// Severity → display label + visual treatment. Only "moderate" and
// "significant" earn the brand-red ink; lower severities stay neutral
// so the eye lands on what matters.
const SEVERITY_DISPLAY: Record<
  string,
  { label: string; isRed: boolean }
> = {
  faultless: { label: "Faultless", isRed: false },
  light: { label: "Light", isRed: false },
  moderate: { label: "Moderate", isRed: true },
  significant: { label: "Significant", isRed: true },
};

export default function ConditionReport({
  report,
  productCondition,
  productName,
}: Props) {
  const { report: header, items } = report;
  const itemCount = items.length;
  const itemNoun = itemCount === 1 ? "Observation" : "Observations";

  return (
    <section
      aria-labelledby="condition-report-heading"
      className="border-t-2 border-ink/90 pt-8"
    >
      {/* Eyebrow */}
      <p
        id="condition-report-heading"
        className="text-[10px] uppercase tracking-[0.22em] font-bold text-brand-red mb-6"
      >
        Condition report
      </p>

      {/* Header: grade badge + summary side-by-side on sm+, stacked on
          mobile so the summary text doesn't crush against the badge. */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-5 sm:gap-6">
        <div className="shrink-0">
          <ConditionBadge
            condition={productCondition}
            grade={header.grade}
            size="lg"
          />
        </div>
        {header.summary && (
          <p className="text-base sm:text-lg leading-relaxed text-ink/85 max-w-prose">
            {header.summary}
          </p>
        )}
      </div>

      {/* Observations heading */}
      <div className="mt-12 mb-6 flex items-baseline gap-3 border-b border-rule pb-3">
        <h3 className="text-[11px] uppercase tracking-[0.22em] font-bold text-ink">
          {itemNoun}
        </h3>
        <span
          className="text-[11px] uppercase tracking-[0.22em] text-ink/40 tabular-nums"
          aria-label={`${itemCount} ${itemNoun.toLowerCase()} noted`}
        >
          · {itemCount}
        </span>
      </div>

      {/* Observation list */}
      <ol className="divide-y divide-rule">
        {items.map((item, index) => {
          const severityKey = item.severity ?? "";
          const display = SEVERITY_DISPLAY[severityKey] ?? {
            label: severityKey,
            isRed: false,
          };

          return (
            <li
              key={item.id}
              className="py-8 first:pt-0 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4 sm:gap-8"
            >
              {/* Left column: severity + area. On mobile this stacks
                  above the description; on sm+ it sits to the left. */}
              <div className="flex flex-col gap-1.5">
                <p
                  className={`text-[10px] uppercase tracking-[0.22em] font-bold ${
                    display.isRed ? "text-brand-red" : "text-ink/55"
                  }`}
                >
                  {display.label}
                </p>
                {item.area && (
                  <p className="text-sm font-bold text-ink leading-snug">
                    {item.area}
                  </p>
                )}
                <p
                  className="text-[10px] uppercase tracking-[0.18em] text-ink/30 tabular-nums mt-0.5"
                  aria-label={`Item ${index + 1} of ${itemCount}`}
                >
                  {String(index + 1).padStart(2, "0")} /{" "}
                  {String(itemCount).padStart(2, "0")}
                </p>
              </div>

              {/* Right column: description + optional image */}
              <div className="flex flex-col gap-4">
                {item.description && (
                  <p className="text-sm sm:text-base text-ink leading-relaxed">
                    {item.description}
                  </p>
                )}

                {item.image && item.image.cloudinary_url && (
                  <figure className="mt-2">
                    <div className="relative w-full aspect-[16/10] bg-rule/40 overflow-hidden">
                      <Image
                        src={item.image.cloudinary_url}
                        alt={
                          item.image.alt_text ??
                          `${productName} — ${display.label.toLowerCase()} ${
                            item.area ?? "observation"
                          }`
                        }
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 600px"
                      />
                    </div>
                    {item.image.alt_text && (
                      <figcaption className="mt-2 text-[11px] uppercase tracking-[0.18em] text-ink/40">
                        {item.image.alt_text}
                      </figcaption>
                    )}
                  </figure>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
