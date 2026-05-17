import Link from "next/link";
import ProductForm from "../_ProductForm";

/**
 * Create-product page. Just a thin wrapper around ProductForm with no
 * initialProduct prop, so the form runs in create mode.
 */
export default function NewProductPage() {
  return (
    <div>
      <div className="border-b border-rule pb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-ink/60">
          <Link href="/admin/products" className="hover:text-brand-red">
            Catalogue
          </Link>
          {" / "}
          New
        </p>
        <h1 className="mt-1 text-4xl font-black tracking-tight">
          New product
        </h1>
      </div>

      <div className="mt-10">
        <ProductForm />
      </div>
    </div>
  );
}

