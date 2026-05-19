import type { Database } from "@/types/database";

type Condition = Database["public"]["Enums"]["product_condition"];
type Grade = Database["public"]["Enums"]["product_grade"];

/**
 * Corner-tab condition badge. The visual atom that appears on:
 *   - The detail page gallery (top-left overlay)
 *   - Listing cards (top-left of card)
 *   - The condition report header (inline)
 *
 * Used items get "USED · GRADE A/B/C". New items get a small "NEW"
 * tab for symmetry — the briefs were undecided on this and we
 * chose symmetry so the visual grammar is consistent across the site.
 *
 * Three sizes: sm (listing card), md (detail page gallery), lg
 * (condition report header). Black backdrop, white type, tracked
 * uppercase. The red dot separator on used items echoes the
 * breadcrumb pattern.
 */

type ConditionBadgeProps = {
  condition: Condition;
  grade: Grade | null;
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASSES = {
  sm: "text-[9px] tracking-[0.18em] px-2.5 py-1.5",
  md: "text-[11px] tracking-[0.22em] px-3.5 py-2",
  lg: "text-xs tracking-[0.24em] px-4 py-2.5",
} as const;

const DOT_CLASSES = {
  sm: "w-1 h-1",
  md: "w-1.5 h-1.5",
  lg: "w-2 h-2",
} as const;

export default function ConditionBadge({
  condition,
  grade,
  size = "md",
}: ConditionBadgeProps) {
  if (condition === "new") {
    return (
      <span
        className={`inline-flex items-center bg-ink text-white font-bold uppercase ${SIZE_CLASSES[size]}`}
      >
        New
      </span>
    );
  }

  // Used path
  return (
    <span
      className={`inline-flex items-center gap-2 bg-ink text-white font-bold uppercase ${SIZE_CLASSES[size]}`}
    >
      <span>Used</span>
      {grade && (
        <>
          <span
            aria-hidden="true"
            className={`inline-block rounded-full bg-brand-red ${DOT_CLASSES[size]}`}
          />
          <span>Grade {grade}</span>
        </>
      )}
    </span>
  );
}
