import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProductForm from "../_ProductForm";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
  // ?saved=1 is set by the create flow's redirect so the freshly-created
  // product's edit page opens in the post-save success state.
  searchParams: Promise<{ saved?: string }>;
}

/**
 * Edit-product page. Fetches the product by ID, 404s if not found,
 * and renders ProductForm with the existing data.
 */
export default async function EditProductPage({
  params,
  searchParams,
}: EditProductPageProps) {
  const { id } = await params;
  const { saved } = await searchParams;
  const supabase = await createClient();

  // Four parallel fetches — the product, attached images, existing
  // category assignments, and all active categories for the picker.
  // Only the product's existence gates the page.
  const [
    productResult,
    imagesResult,
    assignmentsResult,
    categoriesResult,
    reportResult,
    reportItemsResult,
  ] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase
      .from("product_images")
      .select("*")
      .eq("product_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_categories")
      .select("category_id")
      .eq("product_id", id),
    supabase
      .from("categories")
      .select("id, name, slug, kind")
      .eq("is_active", true)
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true }),
    // Condition report (one per product, may not exist yet)
    supabase
      .from("condition_reports")
      .select("*")
      .eq("product_id", id)
      .maybeSingle(),
    // Items for that report (sorted). Two-step but cheap; the items
    // are joined via report_id which we don't know yet, so we fetch
    // by product_id through the join. supabase-js can do this via
    // a nested select on condition_reports, but here we do it as a
    // separate query joined client-side once we know the report id.
    // For now we just fetch all items where the parent report
    // belongs to this product — using an inner-join filter.
    supabase
      .from("condition_report_items")
      .select("*, condition_reports!inner(product_id)")
      .eq("condition_reports.product_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  if (productResult.error || !productResult.data) {
    notFound();
  }
  const product = productResult.data;
  const images = imagesResult.data ?? [];
  const initialCategoryIds = (assignmentsResult.data ?? []).map(
    (a) => a.category_id
  );
  const allCategories = categoriesResult.data ?? [];
  const initialReport = reportResult.data ?? null;
  // Strip the joined condition_reports child off each item — it was
  // only there to filter by product_id.
  const initialReportItems = (reportItemsResult.data ?? []).map(
    ({ condition_reports: _drop, ...item }) => item
  );

  return (
    <div>
      <div className="border-b border-rule pb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-ink/60">
          <Link href="/admin/products" className="hover:text-brand-red">
            Catalogue
          </Link>
          {" / "}
          <span className="font-mono">{product.sku}</span>
        </p>
        <h1 className="mt-1 text-4xl font-black tracking-tight">
          {product.name}
        </h1>
      </div>

      <div className="mt-10">
        <ProductForm
          initialProduct={product}
          initialImages={images}
          allCategories={allCategories}
          initialCategoryIds={initialCategoryIds}
          initialReport={initialReport}
          initialReportItems={initialReportItems}
          justSaved={saved === "1"}
        />
      </div>
    </div>
  );
}

