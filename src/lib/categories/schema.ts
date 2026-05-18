import { z } from "zod";

/**
 * Category schema — validates input for category CRUD.
 *
 * Used by:
 *   - createCategory / updateCategory Server Actions
 *   - <CategoryForm> component (derives form types)
 *
 * Slug uniqueness is enforced by DB constraint, not here — we only
 * validate format. Slug auto-generation from name happens in the
 * form layer before submission, not in the schema.
 */

const slugRegex = /^[a-z0-9-]+$/;

export const categoryKindEnum = z.enum([
  "functional",
  "brand",
  "merchandising",
]);

export type CategoryKind = z.infer<typeof categoryKindEnum>;

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(80)
    .regex(
      slugRegex,
      "Slug must be lowercase letters, numbers, and hyphens only"
    ),
  description: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  kind: categoryKindEnum,
  parent_id: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

export type CategoryInput = z.infer<typeof categorySchema>;

/**
 * Helper: slugify a name into a URL-safe slug.
 * Used by the category form to auto-populate slug from name on blur.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
