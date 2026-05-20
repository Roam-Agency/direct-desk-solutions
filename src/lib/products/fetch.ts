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
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

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
 * Attach the hero image (or null) to each product. Used by the listing
 * helpers as a shared post-processing step so the SQL stays simple and
 * the heroless-products fallback only lives in one place.
 */
export async function attachHeroImagesToProducts(
  products: ProductRow[]
): Promise<ProductCard[]> {
  if (products.length === 0) return [];

  const supabase = await createClient();
  const productIds = products.map((p) => p.id);

  const { data: heroes, error } = await supabase
    .from("product_images")
    .select("product_id, cloudinary_url, alt_text")
    .in("product_id", productIds)
    .eq("is_hero", true);

  if (error) {
    console.error("attachHeroImagesToProducts error", { error });
    // Degrade to imageless cards rather than blowing up the page.
    return products.map((p) => ({
      ...p,
      hero_image_url: null,
      hero_image_alt: null,
    }));
  }

  const heroByProductId = new Map<
    string,
    { cloudinary_url: string; alt_text: string | null }
  >();
  for (const row of heroes ?? []) {
    heroByProductId.set(row.product_id, {
      cloudinary_url: row.cloudinary_url,
      alt_text: row.alt_text,
    });
  }

  return products.map((p) => {
    const hero = heroByProductId.get(p.id);
    return {
      ...p,
      hero_image_url: hero?.cloudinary_url ?? null,
      hero_image_alt: hero?.alt_text ?? null,
    };
  });
}

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
 * Search live products by name + description using a case-insensitive
 * substring match. Returns ProductCard[] in the same shape as
 * listLiveProducts so the existing ListingGrid renders results unchanged.
 *
 * Behaviour:
 *   - Empty or whitespace-only queries return [].
 *   - Queries longer than 100 characters are truncated. Search has no
 *     legitimate need for War and Peace as input.
 *   - The % and _ characters in user input are escaped so they're
 *     treated as literal characters rather than ilike wildcards. A
 *     search for "100%" should match products that contain "100%",
 *     not every product in the catalogue.
 *
 * Why this and not full-text search: the catalogue is small (single
 * digits of products on launch, ~10-50 at maturity). ilike is more
 * than enough and avoids an `tsvector` column + indexing setup. If the
 * catalogue grows past where ilike is fast, swap this helper's body
 * for a tsvector query — the call sites don't change.
 */
export async function searchProducts(opts: {
  query: string;
  sortBy?: ListingSort;
}): Promise<ProductCard[]> {
  const trimmed = opts.query.trim().slice(0, 100);
  if (trimmed.length === 0) return [];

  // Escape ilike metacharacters so % and _ in user input are literal.
  const escaped = trimmed.replace(/[\\%_]/g, "\\$&");
  const pattern = `%${escaped}%`;

  const supabase = await createClient();
  const sortBy = opts.sortBy ?? _DEFAULT_SORT;

  const query = supabase
    .from("products")
    .select("*")
    .eq("status", "live")
    .or(`name.ilike.${pattern},description.ilike.${pattern}`);

  if (sortBy === "price-asc") {
    query.order("price_pence", { ascending: true });
  } else if (sortBy === "price-desc") {
    query.order("price_pence", { ascending: false });
  } else {
    query.order("published_at", { ascending: false, nullsFirst: false });
  }

  const { data, error } = await query;

  if (error) {
    console.error("searchProducts error", { opts, error });
    return [];
  }

  // Reuse the shared hero-image attachment helper.
  return attachHeroImagesToProducts(data ?? []);
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

/**
 * The brand-tile projection returned by listBrandsWithCounts.
 *
 * Includes the category row plus a `live_product_count` computed by
 * joining through product_categories to the products table. Used by
 * the /brands index page to render each brand tile with a "X items"
 * or "Coming soon" subtitle.
 */
export type BrandWithCount = CategoryRow & {
  live_product_count: number;
};

/**
 * List all active brand categories, sorted by sort_order then name,
 * with a count of live products attached to each.
 *
 * The count reflects the current state of the catalogue — a brand with
 * zero live products is included in the result (rendered as "Coming
 * soon" on the index). Hiding zero-count brands would mean discovering
 * them requires knowing the URL, which kills the editorial intent.
 */
export async function listBrandsWithCounts(): Promise<BrandWithCount[]> {
  const supabase = await createClient();

  // Fetch the brand categories first. Two queries is cleaner here than
  // a single SQL with a subselect, because supabase-js's typed select
  // doesn't have a great affordance for scalar subselects.
  const { data: brands, error: brandsError } = await supabase
    .from("categories")
    .select("*")
    .eq("kind", "brand")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (brandsError) {
    console.error("listBrandsWithCounts error (brands)", { brandsError });
    return [];
  }

  if (!brands || brands.length === 0) return [];

  // For each brand, count the joined live products. One round-trip
  // for the join, grouped in JS — simpler than an SQL count(*)+group_by
  // through supabase-js's API.
  const brandIds = brands.map((b) => b.id);
  const { data: joins, error: joinsError } = await supabase
    .from("product_categories")
    .select("category_id, product:products!inner(status)")
    .in("category_id", brandIds)
    .eq("product.status", "live");

  if (joinsError) {
    console.error("listBrandsWithCounts error (joins)", { joinsError });
    // Degrade to zero counts rather than blowing up the page.
    return brands.map((b) => ({ ...b, live_product_count: 0 }));
  }

  const countByCategoryId = new Map<string, number>();
  for (const row of joins ?? []) {
    countByCategoryId.set(
      row.category_id,
      (countByCategoryId.get(row.category_id) ?? 0) + 1
    );
  }

  return brands.map((b) => ({
    ...b,
    live_product_count: countByCategoryId.get(b.id) ?? 0,
  }));
}

/**
 * The result of looking up a brand by slug + its live products.
 *
 * Returns null if no active brand with that slug exists. Products
 * comes back as an empty array if the brand exists but has no live
 * products attached — the calling page renders an empty-state message.
 */
export type BrandWithProducts = {
  brand: CategoryRow;
  products: ProductCard[];
};

/**
 * Look up a brand category by slug and return it alongside its live
 * products as ProductCards.
 *
 * Returns null if:
 *   - No category matches the slug
 *   - The matching category is not kind='brand'
 *   - The matching category is not is_active=true
 *
 * The page calling this should treat null as a 404. An existing brand
 * with zero live products is NOT null — it returns { brand, products: [] }
 * so the page can render the brand header with an empty-state message
 * underneath.
 */
export async function listLiveProductsByBrandSlug(opts: {
  brandSlug: string;
  sortBy?: ListingSort;
}): Promise<BrandWithProducts | null> {
  const supabase = await createClient();
  const sortBy = opts.sortBy ?? _DEFAULT_SORT;

  // Resolve the brand category first. If it doesn't exist (or isn't
  // active, or isn't kind='brand'), the page should 404 — we return
  // null and let the caller handle it.
  const { data: brand, error: brandError } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", opts.brandSlug)
    .eq("kind", "brand")
    .eq("is_active", true)
    .maybeSingle();

  if (brandError) {
    console.error("listLiveProductsByBrandSlug error (brand)", {
      opts,
      brandError,
    });
    return null;
  }

  if (!brand) return null;

  // Fetch the product IDs joined to this brand. We do this as a
  // separate query rather than a single big join, because the
  // join-and-flatten dance through product_categories returns nested
  // rows that are awkward to project to ProductCard shape.
  const { data: joins, error: joinsError } = await supabase
    .from("product_categories")
    .select("product_id")
    .eq("category_id", brand.id);

  if (joinsError) {
    console.error("listLiveProductsByBrandSlug error (joins)", {
      opts,
      joinsError,
    });
    return { brand, products: [] };
  }

  const productIds = (joins ?? []).map((j) => j.product_id);
  if (productIds.length === 0) return { brand, products: [] };

  // Now fetch the live products themselves with the same sort logic
  // as listLiveProducts.
  const query = supabase
    .from("products")
    .select("*")
    .in("id", productIds)
    .eq("status", "live");

  if (sortBy === "price-asc") {
    query.order("price_pence", { ascending: true });
  } else if (sortBy === "price-desc") {
    query.order("price_pence", { ascending: false });
  } else {
    query.order("published_at", { ascending: false, nullsFirst: false });
  }

  const { data: products, error: productsError } = await query;

  if (productsError) {
    console.error("listLiveProductsByBrandSlug error (products)", {
      opts,
      productsError,
    });
    return { brand, products: [] };
  }

  // Attach hero images via the shared helper.
  const productCards = await attachHeroImagesToProducts(products ?? []);
  return { brand, products: productCards };
}
