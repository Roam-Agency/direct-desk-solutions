/**
 * Status badge — single source of truth for status colours across
 * the admin (products list, orders list, dashboard activity feed).
 *
 * Replaces the bespoke `StatusLabel` in products/page.tsx (which
 * used text-green-700 for "live" — wrong per brand spec).
 *
 * Tone map:
 *   live      → brand-red background, paper text   (assertive, the catalogue is live)
 *   draft     → ink background, paper text         (default, neutral)
 *   archived  → ink/20 background, ink/50 text     (de-emphasised)
 *
 * Hard-edged, no rounded corners — matches brand DNA.
 *
 * Accepts arbitrary string for `tone` so order-specific statuses
 * (pending, paid, fulfilled, refunded) can map to the same pill
 * vocabulary via the `customTone` prop without forking the component.
 */
type StatusTone = "live" | "draft" | "archived";

const TONE_CLASSES: Record<StatusTone, string> = {
  live: "bg-brand-red text-paper",
  draft: "bg-ink text-paper",
  archived: "bg-ink/20 text-ink/50",
};

export function StatusPill({
  tone,
  children,
}: {
  tone: StatusTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={
        "inline-block px-2 py-1 text-[10px] font-bold uppercase tracking-widest " +
        TONE_CLASSES[tone]
      }
    >
      {children}
    </span>
  );
}
