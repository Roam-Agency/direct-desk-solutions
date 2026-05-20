import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/server";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://direct-desk-solutionse.netlify.app";

const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "", changeFrequency: "weekly", priority: 1.0 },
  { path: "/products", changeFrequency: "daily", priority: 0.9 },
  { path: "/products/new", changeFrequency: "daily", priority: 0.9 },
  { path: "/products/used", changeFrequency: "daily", priority: 0.9 },
  { path: "/brands", changeFrequency: "weekly", priority: 0.7 },
  { path: "/search", changeFrequency: "monthly", priority: 0.4 },
  { path: "/about", changeFrequency: "monthly", priority: 0.6 },
  { path: "/why-used", changeFrequency: "monthly", priority: 0.7 },
  { path: "/how-we-refurbish", changeFrequency: "monthly", priority: 0.7 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const supabase = createAdminClient();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("slug, updated_at")
    .eq("status", "live");

  if (productsError) {
    console.error("[sitemap] failed to fetch products:", productsError);
  }

  const productEntries: MetadataRoute.Sitemap = (products ?? []).map((p) => ({
    url: `${SITE_URL}/products/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const { data: brands, error: brandsError } = await supabase
    .from("categories")
    .select("slug, updated_at")
    .eq("kind", "brand")
    .eq("is_active", true);

  if (brandsError) {
    console.error("[sitemap] failed to fetch brand categories:", brandsError);
  }

  const brandEntries: MetadataRoute.Sitemap = (brands ?? []).map((b) => ({
    url: `${SITE_URL}/brand/${b.slug}`,
    lastModified: b.updated_at ? new Date(b.updated_at) : now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticEntries, ...productEntries, ...brandEntries];
}
