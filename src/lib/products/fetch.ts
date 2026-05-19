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
import type { ListingSort } from "./listing-sort";
import { DEFAULT_LISTING_SORT as _DEFAULT_SORT } from "./listing-sort";

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

/**
 * Listing sort constants live in their own module so client components
 * can import them without pulling in the Supabase server client (which
 * uses next/headers and breaks client bundles). Re-export here so
 * server callers can import the helper + type from one place.
 */
export type { ListingSort } from "./listing-sort";
export {
  LISTING_SORTS,
  DEFAULT_LISTING_SORT,
} from "./listing-sort";

/**
 * The card-shaped projection returned by listLiveProducts.
 *
 * Includes the bare product row plus the hero image's URL + alt — both
 * the listing card needs, neither requires a second query per row.
 */
export type ProductCard = ProductRow & {
  hero_image_url: string | null;
  hero_image_alt: string | null;
};

/**
 * List all live products of a given condition, with their hero image
 * URL attached for the listing card render.
 *
 * Returns an empty array if nothing matches. RLS hides draft/archived
 * rows automatically; the explicit .eq("status", "live") is belt-and-
 * braces and also makes the SQL plan obvious.
 *
 * Sort is server-side and uses the listing's canonical sort values.
 */
export async function listLiveProducts(opts: {
  condition: "new" | "used";
  sortBy?: ListingSort;
}): Promise<ProductCard[]> {
  const supabase = await createClient();
  const sortBy = opts.sortBy ?? _DEFAULT_SORT;

  // Pull the hero image inline via a nested select. Filter to is_hero=true
  // on the join so we only get the one row per product. Supabase returns
  // it as an array (joins always are), so we flatten in the map below.
  const query = supabase
    .from("products")
    .select(
      `
      *,
      hero:product_images!inner (
        cloudinary_url,
        alt_text,
        is_hero
      )
      `
    )
    .eq("status", "live")
    .eq("condition", opts.condition)
    .eq("hero.is_hero", true);

  // Apply sort
  if (sortBy === "price-asc") {
    query.order("price_pence", { ascending: true });
  } else if (sortBy === "price-desc") {
    query.order("price_pence", { ascending: false });
  } else {
    query.order("published_at", { ascending: false, nullsFirst: false });
  }

  const { data, error } = await query;

  if (error) {
    console.error("listLiveProducts error", { opts, error });
    return [];
  }

  // Also fetch products that have no hero image (the !inner join above
  // excludes them). We want them visible in the listing — just without
  // the hero — so they don't silently disappear from the shop.
  const productsWithHero = (data ?? []).map((row) => {
    // `hero` is always an array from the nested select. Take the first
    // (and only, since we filtered to is_hero=true) entry.
    const heroArr = (row as unknown as { hero: { cloudinary_url: string; alt_text: string | null }[] }).hero;
    const hero = heroArr && heroArr.length > 0 ? heroArr[0] : null;
    const { hero: _omit, ...product } = row as ProductRow & { hero: unknown };
    return {
      ...(product as ProductRow),
      hero_image_url: hero?.cloudinary_url ?? null,
      hero_image_alt: hero?.alt_text ?? null,
    };
  });

  // Now fetch products with no images at all (left out by inner join)
  const productsWithHeroIds = new Set(productsWithHero.map((p) => p.id));
  const { data: allLive } = await supabase
    .from("products")
    .select("*")
    .eq("status", "live")
    .eq("condition", opts.condition);

  const heroless = (allLive ?? [])
    .filter((p) => !productsWithHeroIds.has(p.id))
    .map((p) => ({
      ...p,
      hero_image_url: null,
      hero_image_alt: null,
    }));

  // Combine and re-sort (the heroless products came in unordered)
  const combined: ProductCard[] = [...productsWithHero, ...heroless];

  if (sortBy === "price-asc") {
    combined.sort((a, b) => a.price_pence - b.price_pence);
  } else if (sortBy === "price-desc") {
    combined.sort((a, b) => b.price_pence - a.price_pence);
  } else {
    combined.sort((a, b) => {
      const aDate = a.published_at ?? a.created_at;
      const bDate = b.published_at ?? b.created_at;
      return bDate.localeCompare(aDate);
    });
  }

  return combined;
}

/**
 * Count live products by condition. Used by the /products split landing
 * page to show "X new / Y used" hint text on each tile.
 */
export async function countLiveProductsByCondition(): Promise<{
  new: number;
  used: number;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("condition")
    .eq("status", "live");

  if (error) {
    console.error("countLiveProductsByCondition error", { error });
    return { new: 0, used: 0 };
  }

  const counts = { new: 0, used: 0 };
  for (const row of data ?? []) {
    if (row.condition === "new") counts.new += 1;
    else if (row.condition === "used") counts.used += 1;
  }

  return counts;
}
