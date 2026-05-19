import Link from "next/link";

/**
 * Public breadcrumb. Small tracked uppercase with red dot separators.
 * Each crumb is a Link if href is provided, else plain text (the
 * current page).
 *
 * Used inline at the top of each (public) page's content. We don't put
 * it in the layout because each page knows its own crumbs best — and
 * lifting it to context would be premature abstraction for v1.
 */

export type Crumb = {
  label: string;
  href?: string;
};

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink/60"
    >
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-x-2">
            {item.href ? (
              <Link
                href={item.href}
                className="hover:text-ink transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-ink" aria-current="page">
                {item.label}
              </span>
            )}
            {i < items.length - 1 && (
              <span
                aria-hidden="true"
                className="inline-block w-1 h-1 rounded-full bg-brand-red"
              />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
