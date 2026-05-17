import { z } from "zod";

/**
 * Product schema — the single source of truth for what a valid product is.
 *
 * Used by:
 *   - createProduct / updateProduct Server Actions (validates submitted form data)
 *   - <ProductForm> component (derives the form's TypeScript types)
 *
 * The DB stores money as integer pence (no float drift). The form converts
 * the displayed £xx.xx to pence before submission. SKU and slug uniqueness
 * is enforced by DB constraints, not here — we only validate format.
 */

const skuRegex = /^[A-Z0-9-]+$/;
const slugRegex = /^[a-z0-9-]+$/;

/**
 * Recursive Json type matching Supabase's generated Json definition.
 * Used for the `specifications` jsonb column so the inferred TS type
 * lines up exactly with what the Supabase typed client expects.
 */
type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonSchema),
    z.record(z.string(), jsonSchema),
  ])
);

const dimensionsSchema = z.object({
  width_cm: z.number().positive().nullable(),
  depth_cm: z.number().positive().nullable(),
  height_cm: z.number().positive().nullable(),
});

export const productSchema = z
  .object({
    // Identity
    sku: z
      .string()
      .min(3, "SKU must be at least 3 characters")
      .max(50, "SKU must be 50 characters or fewer")
      .regex(skuRegex, "SKU must be uppercase letters, numbers, and dashes only"),
    slug: z
      .string()
      .min(3, "Slug must be at least 3 characters")
      .max(100)
      .regex(slugRegex, "Slug must be lowercase letters, numbers, and dashes only"),
    name: z.string().min(1, "Name is required").max(200),
    description: z.string().max(5000).nullable(),
    brand: z.string().max(100).nullable(),

    // Money (in pence — integer)
    price_pence: z.number().int().nonnegative("Price cannot be negative"),
    was_price_pence: z.number().int().nonnegative().nullable(),
    cost_price_pence: z.number().int().nonnegative().nullable(),

    // Stock & ops
    stock_quantity: z.number().int().nonnegative().default(0),
    low_stock_alert: z.number().int().nonnegative().nullable(),
    warehouse_location: z.string().max(100).nullable(),

    // Status
    status: z.enum(["draft", "live", "archived"]).default("draft"),

    // Physical
    weight_kg: z.number().positive().nullable(),
    dimensions: dimensionsSchema.nullable(),

    // Condition (new vs used)
    condition: z.enum(["new", "used"]),
    condition_grade: z.enum(["A", "B", "C"]).nullable(),
    condition_notes: z.string().max(2000).nullable(),
    source: z.string().max(200).nullable(),
    refurb_date: z.string().nullable(), // ISO date string; DB stores as date

    // Tags & free-form spec
    tags: z.array(z.string().min(1)).default([]),
    specifications: jsonSchema.nullable(),
  })
  .superRefine((data, ctx) => {
    // Used items must have a grade; new items must not.
    if (data.condition === "used" && !data.condition_grade) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["condition_grade"],
        message: "Grade is required for used items",
      });
    }
    if (data.condition === "new" && data.condition_grade) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["condition_grade"],
        message: "New items cannot have a condition grade",
      });
    }

    // If a was_price is set, it should be higher than the current price
    // (otherwise the strikethrough makes no sense).
    if (
      data.was_price_pence !== null &&
      data.was_price_pence <= data.price_pence
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["was_price_pence"],
        message: "Was-price must be higher than current price",
      });
    }
  });

export type ProductInput = z.infer<typeof productSchema>;

