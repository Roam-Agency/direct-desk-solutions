/**
 * In-form section break: uppercase title above a strong ink rule.
 *
 * Used inside long forms (product edit, category edit) to delineate
 * groups of fields without resorting to grey boxes. The treatment
 * from the brief: `mt-12 mb-8 pb-4 border-b-2 border-ink`.
 *
 * Optional `hint` is a short subtitle rendered to the right of the
 * title for context (e.g. "Used items only" or "Auto-computed").
 */
export function SectionDivider({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="mt-12 mb-8 flex items-baseline justify-between border-b-2 border-ink pb-4">
      <h2 className="text-sm font-bold uppercase tracking-widest text-ink">
        {title}
      </h2>
      {hint ? (
        <span className="text-xs text-ink/50">{hint}</span>
      ) : null}
    </div>
  );
}
