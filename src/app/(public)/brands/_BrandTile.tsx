/**
 * Brand tile.
 *
 * Renders on the /brands index page. One tile per active brand
 * category. Restrained editorial treatment: brand wordmark in
 * Archivo Black at scale, count subtitle, no hover scale.
 *
 * "Coming soon" reads as deliberate curation when a brand has zero
 * live products — Vitra is the example today.
 *
 * Links through to /brand/[slug] for the brand landing page.
 */

import Link from "next/link";

export default function BrandTile({
  slug,
  name,
  count,
}: {
  slug: string;
  name: string;
  count: number;
}) {
  const subtitle =
    count === 0
      ? "Coming soon"
      : count === 1
      ? "1 item"
      : `${count} items`;

  return (
    <Link
      href={`/brand/${slug}`}
      className="group block focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 focus:ring-offset-paper"
    >
      <article className="relative aspect-[3/2] bg-ink text-paper p-6 sm:p-8 flex flex-col justify-between">
        {/* Wordmark — top-left, breaks to two lines if long */}
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tight leading-[0.95] max-w-[12ch]">
          {name}
        </h2>

        {/* Count — bottom-left */}
        <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-paper/60">
          {subtitle}
        </p>
      </article>
    </Link>
  );
}
