import { z } from "zod";

/**
 * Condition report schema — drives the admin authoring form and validates
 * Server Action input.
 *
 * The report itself is a thin wrapper around (product_id, summary, grade).
 * Items carry the actual cataloguing detail: severity + area + description,
 * with an optional link to a specific image so the buyer can see exactly
 * what the note refers to.
 *
 * Schema is intentionally permissive: empty/null summary is fine, grade is
 * optional. Items are the source of substance.
 */

export const conditionSeverityValues = [
  "faultless",
  "light",
  "moderate",
  "significant",
] as const;

export const conditionReportSchema = z.object({
  // Caller normalises empty strings to null before sending.
  summary: z
    .string()
    .max(2000, "Keep the summary under 2000 characters")
    .nullable()
    .optional(),
  grade: z.enum(["A", "B", "C"]).nullable().optional(),
});

export type ConditionReportInput = z.infer<typeof conditionReportSchema>;

export const conditionReportItemSchema = z.object({
  severity: z.enum(conditionSeverityValues),
  area: z
    .string()
    .min(2, "Area required (e.g. 'right armrest')")
    .max(120, "Keep the area short"),
  description: z
    .string()
    .min(2, "Description required")
    .max(1000, "Keep descriptions under 1000 characters"),
  image_id: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v ?? null)),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export type ConditionReportItemInput = z.infer<
  typeof conditionReportItemSchema
>;
