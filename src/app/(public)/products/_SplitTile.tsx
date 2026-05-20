import Link from "next/link";

/**
 * Split tile.
 *
 * The big "Shop New" / "Shop Used" entry tiles used on the /products
 * landing page (and, in Session 5, on the homepage). Black-paper tiles
 * with optional red accent strip — design language sets up the buyer
 * for the badged corner tabs they\u2019ll see on listing cards.
 *
 * Designed to scale: stacks on mobile, sits side-by-side from sm+.
 */

export default function SplitTile({
  href,
  eyebrow,
  title,
  blurb,
  count,
  accent,
}: {
  href: string;
  eyebrow: string;
  title: string;
  blurb: string;
  count: number;
  accent?: "red" | "none";
}) {
  return (
    <Link
      href={href}
      className="group block relative bg-ink text-paper p-8 sm:p-10 lg:p-12 min-h-[260px] sm:min-h-[320px] lg:min-h-[420px] focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 focus:ring-offset-paper"
    >
      {accent === "red" && (
        <div className="absolute top-0 right-0 bg-brand-red px-3 py-1.5">
          <span className="text-[10px] uppercase tracking-[0.22em] font-black text-paper">
            Save 50%+
          </span>
        </div>
      )}

      <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-paper/60 mb-4">
        {eyebrow}
      </p>
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4 leading-[0.95]">
        {title}
      </h2>
      <p className="text-sm sm:text-base text-paper/70 leading-relaxed max-w-md mb-8">
        {blurb}
      </p>

      <div className="flex items-end justify-between absolute bottom-8 sm:bottom-10 lg:bottom-12 left-8 sm:left-10 lg:left-12 right-8 sm:right-10 lg:right-12">
        <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-paper/60">
          {count} {count === 1 ? "item" : "items"}
        </span>
        <span className="text-xs uppercase tracking-[0.18em] font-bold border-b-2 border-paper pb-1 group-hover:opacity-70 transition-opacity">
          Shop \u2192
        </span>
      </div>
    </Link>
  );
}
