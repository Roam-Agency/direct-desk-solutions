/**
 * Buyer-side product fetch helpers.
 *
 * Pure read helpers consumed by Server Components in src/app/(public)/.
 * Always use the cookie-bound createClient() so RLS does its job and
 * anonymous visitors only see live products and published reports.
 *
 * NEVER call these from the admin surface — the admin needs draft +
 * archived + unpublished rows, which RLS hides from the publishable key.
 *
 * Money in this codebase is integer pence. These helpers pass the raw
 * pence values through; formatting is the caller's responsibility (see
 * format.ts in this directory).
 */

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductImageRow = Database["public"]["Tables"]["product_images"]["Row"];
type ConditionReportRow =
  Database["public"]["Tables"]["condition_reports"]["Row"];
type ConditionReportItemRow =
  Database["public"]["Tables"]["condition_report_items"]["Row"];

/**
 * Look up a single product by its URL slug.
 *
 * Returns null if no product matches or if the matching product is not
 * live (RLS hides draft/archived rows from the anon role; the explicit
 * .eq("status", "live") below is belt-and-braces).
 */
export async function getProductBySlug(
  slug: string
): Promise<ProductRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();

  if (error) {
    console.error("getProductBySlug error", { slug, error });
    return null;
  }

  return data;
}

/**
 * Fetch all images for a product, hero first, then by sort_order.
 *
 * Returns an empty array if the product has no images (or doesn't exist
 * — RLS will hide images attached to non-live products too because the
 * RLS policy on product_images joins through to products.status).
 */
export async function getProductImages(
  productId: string
): Promise<ProductImageRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", productId)
    .order("is_hero", { ascending: false })
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("getProductImages error", { productId, error });
    return [];
  }

  return data ?? [];
}

/**
 * The shape returned by getPublishedConditionReport().
 *
 * Each item carries its optional linked image inline so the detail-page
 * render doesn't have to do a per-item lookup. `image` is null when the
 * observation isn't tied to a specific photo.
 */
export type ConditionReportItemWithImage = ConditionReportItemRow & {
  image: ProductImageRow | null;
};

export type PublishedConditionReport = {
  report: ConditionReportRow;
  items: ConditionReportItemWithImage[];
};

/**
 * Fetch the published condition report for a product, with its items
 * and linked images all in one round-trip.
 *
 * Returns null if:
 *   - No report exists for the product
 *   - The report exists but published_at is null (draft)
 *
 * The buyer-side publish gate is enforced here — every (public)/ route
 * that wants to show a condition report should go through this helper
 * rather than rolling its own query, so the .not("published_at", "is",
 * null) filter only lives in one place.
 */
export async function getPublishedConditionReport(
  productId: string
): Promise<PublishedConditionReport | null> {
  const supabase = await createClient();

  // Fetch the report header + nested items + per-item linked image
  // in a single query. The join syntax `image:product_images(*)`
  // attaches the row from product_images referenced by image_id.
  const { data, error } = await supabase
    .from("condition_reports")
    .select(
      `
      *,
      items:condition_report_items (
        *,
        image:product_images (*)
      )
      `
    )
    .eq("product_id", productId)
    .not("published_at", "is", null)
    .maybeSingle();

  if (error) {
    console.error("getPublishedConditionReport error", { productId, error });
    return null;
  }

  if (!data) return null;

  // Supabase's nested select returns items as a property on the row.
  // Destructure so the returned shape matches PublishedConditionReport.
  const { items: rawItems, ...report } = data;

  // Items come back unsorted from the join; apply sort_order client-side.
  const items = (rawItems ?? [])
    .map((item) => ({
      ...item,
      image: item.image ?? null,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);

  return { report, items };
}
