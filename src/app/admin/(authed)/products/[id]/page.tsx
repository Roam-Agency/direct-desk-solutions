import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProductForm from "../_ProductForm";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Edit-product page. Fetches the product by ID, 404s if not found,
 * and renders ProductForm with the existing data.
 */
export default async function EditProductPage({
  params,
}: EditProductPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !product) {
    notFound();
  }

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
        <ProductForm initialProduct={product} />
      </div>
    </div>
  );
}

