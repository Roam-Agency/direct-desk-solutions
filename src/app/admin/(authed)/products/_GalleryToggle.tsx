"use client";

export type View = "table" | "gallery";

/**
 * Dumb controlled toggle: shows Table / Gallery buttons and reports
 * clicks to the parent. State + localStorage IO lives in ViewSwitcher.
 */
export function GalleryToggle({
  view,
  onSelect,
}: {
  view: View;
  onSelect: (next: View) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold uppercase tracking-widest text-ink/40">
        View
      </span>
      <div className="flex gap-1">
        <ToggleButton
          active={view === "table"}
          onClick={() => onSelect("table")}
          label="Table"
        />
        <ToggleButton
          active={view === "gallery"}
          onClick={() => onSelect("gallery")}
          label="Gallery"
        />
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  const className = active
    ? "border border-ink bg-ink px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-paper"
    : "border border-rule px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-ink/60 transition hover:border-ink hover:text-ink";
  return (
    <button type="button" onClick={onClick} className={className}>
      {label}
    </button>
  );
}
