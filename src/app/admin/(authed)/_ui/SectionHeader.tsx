/**
 * Page-level section header: uppercase eyebrow above a large h1.
 *
 * Replaces the bespoke "Catalogue / Products" stacked-text block
 * currently duplicated across admin pages. Optional `action` slot on
 * the right takes a button or other element (e.g. "Export CSV" on
 * customers/orders, "New product" on products list).
 *
 * Visual: text-xs uppercase eyebrow at ink/60, h1 in text-4xl
 * font-black tracking-tight. Bottom border uses the strong ink rule
 * for editorial weight (matches in-form section dividers).
 */
export function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-ink/60">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-4xl font-black tracking-tight text-ink">
          {title}
        </h1>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
