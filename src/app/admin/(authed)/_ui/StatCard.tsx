import Link from "next/link";

/**
 * Single metric card for the admin dashboard 4-up grid.
 *
 * When `href` is provided the whole card becomes a Link with a subtle
 * hover state — useful for "click through to filtered view" patterns
 * (e.g. "Drafts 12" → /admin/products?status=draft). When `href` is
 * omitted the card is a static block — useful for informational
 * metrics that have no obvious drill-down.
 *
 * Visual: big black number (text-4xl font-black), uppercase eyebrow
 * label, optional sublabel for context like "vs last week" or
 * "below threshold". Hard-edged, paper background, rule border.
 */
export function StatCard({
  label,
  value,
  href,
  sublabel,
}: {
  label: string;
  value: string | number;
  href?: string;
  sublabel?: string;
}) {
  const inner = (
    <>
      <p className="text-xs font-bold uppercase tracking-widest text-ink/50">
        {label}
      </p>
      <p className="mt-3 text-4xl font-black tabular-nums tracking-tight text-ink">
        {value}
      </p>
      {sublabel ? (
        <p className="mt-2 text-xs text-ink/50">{sublabel}</p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block border border-rule bg-paper p-5 transition hover:border-ink hover:bg-rule/20"
      >
        {inner}
      </Link>
    );
  }

  return <div className="border border-rule bg-paper p-5">{inner}</div>;
}
