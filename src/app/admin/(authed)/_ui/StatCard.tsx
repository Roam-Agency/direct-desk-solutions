import Link from "next/link";

/**
 * Single metric card for the admin dashboard stat grids.
 *
 * When `href` is provided the whole card becomes a Link with a hover lift
 * and a chevron affordance — useful for "click through to filtered view"
 * patterns (e.g. "Drafts 12" → /admin/products?status=draft). When `href`
 * is omitted the card is a static block.
 *
 * `tone` colours the left accent bar so a card can signal meaning at a
 * glance — e.g. an "alert" tone on Low-stock when the count is non-zero,
 * rather than every metric reading as a neutral black number.
 *
 * Visual: hard-edged paper card with a coloured left accent, uppercase
 * eyebrow label, big black number, and an optional sublabel.
 */
type StatTone = "default" | "alert" | "positive";

const TONE_ACCENT: Record<StatTone, string> = {
  default: "bg-ink",
  alert: "bg-brand-red",
  positive: "bg-emerald-500",
};

export function StatCard({
  label,
  value,
  href,
  sublabel,
  tone = "default",
}: {
  label: string;
  value: string | number;
  href?: string;
  sublabel?: string;
  tone?: StatTone;
}) {
  const inner = (
    <>
      {/* Left accent bar — full height, coloured by tone. */}
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 ${TONE_ACCENT[tone]}`}
      />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink/50">
          {label}
        </p>
        {href ? (
          <span
            aria-hidden
            className="text-ink/30 transition-all group-hover:translate-x-0.5 group-hover:text-brand-red"
          >
            →
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-3xl font-black tabular-nums tracking-tight text-ink sm:text-4xl">
        {value}
      </p>
      {sublabel ? (
        <p className="mt-1.5 text-xs text-ink/50">{sublabel}</p>
      ) : null}
    </>
  );

  const base =
    "group relative overflow-hidden border border-rule bg-paper pl-5 pr-4 py-4 sm:py-5";

  if (href) {
    return (
      <Link
        href={href}
        className={`${base} block transition hover:border-ink hover:bg-rule/20`}
      >
        {inner}
      </Link>
    );
  }

  return <div className={base}>{inner}</div>;
}
