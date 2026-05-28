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

import Image from "next/image";
import Link from "next/link";

export default function BrandTile({
  slug,
  name,
  count,
  backgroundImage,
}: {
  slug: string;
  name: string;
  count: number;
  backgroundImage?: string;
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
      <article className="relative aspect-[3/2] bg-ink text-paper p-6 sm:p-8 flex flex-col justify-between overflow-hidden">
        {/* Optional decorative backdrop — darkened so the wordmark stays legible */}
        {backgroundImage && (
          <>
            <Image
              src={backgroundImage}
              alt=""
              aria-hidden="true"
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover opacity-100"
            />
            <div className="absolute inset-0 bg-ink/75" aria-hidden="true" />
          </>
        )}

        {/* Wordmark — top-left, breaks to two lines if long */}
        <h2 className="relative z-10 text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tight leading-[0.95] max-w-[12ch]">
          {name}
        </h2>

        {/* Count — bottom-left */}
        <p className="relative z-10 text-[10px] uppercase tracking-[0.22em] font-bold text-paper/60">
          {subtitle}
        </p>
      </article>
    </Link>
  );
}
