import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getProductBySlug,
  getProductImages,
} from "@/lib/products/fetch";
import Breadcrumb from "../../_Breadcrumb";
import Gallery from "./_Gallery";
import PriceBlock from "./_PriceBlock";
import StockBadge from "./_StockBadge";
import TrustBullets from "./_TrustBullets";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: "Product not found" };
  }

  return {
    title: `${product.name}${product.brand ? ` — ${product.brand}` : ""}`,
    description:
      product.description ??
      `${product.name} from Direct Desk Solutions. New and pre-owned office furniture, delivered across the UK.`,
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const images = await getProductImages(product.id);

  // Determine breadcrumb based on condition. We don't have category
  // lookup wired into v1 because category landing pages don't exist
  // yet (Session 4 work). The middle crumb is intentionally absent.
  const conditionCrumb =
    product.condition === "used"
      ? { label: "Shop Used", href: "/products?condition=used" }
      : { label: "Shop New", href: "/products?condition=new" };

  return (
    <div className="pb-20">
      <div className="mx-auto max-w-7xl px-6 pt-6">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            conditionCrumb,
            { label: product.name },
          ]}
        />
      </div>

      {/* Gallery: scroll-snap carousel with anchored corner tab.
          Per-slide pinch-zoom, progress pills, N/M counter. */}
      <Gallery
        images={images}
        condition={product.condition}
        grade={product.condition_grade}
        productName={product.name}
      />

      <div className="mx-auto max-w-7xl px-6">
        {/* Product identity */}
        <div className="mt-8 space-y-3">
          {product.brand && (
            <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-ink/60">
              {product.brand}
            </p>
          )}
          <h1 className="font-display text-3xl sm:text-4xl tracking-tight leading-tight text-ink">
            {product.name}
          </h1>
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink/40 font-mono">
            SKU {product.sku}
          </p>
        </div>

        {/* Price */}
        <div className="mt-8">
          <PriceBlock
            price_pence={product.price_pence}
            was_price_pence={product.was_price_pence}
          />
        </div>

        {/* Stock state */}
        <div className="mt-6">
          <StockBadge
            stock_quantity={product.stock_quantity}
            low_stock_alert={product.low_stock_alert}
          />
        </div>

        {/* Trust bullets — used items only */}
        {product.condition === "used" && (
          <div className="mt-10">
            <TrustBullets source={product.source} />
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div className="mt-10">
            <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-brand-red mb-3">
              About this {product.condition === "used" ? "piece" : "product"}
            </p>
            <div className="prose prose-sm max-w-none text-ink leading-relaxed whitespace-pre-line">
              {product.description}
            </div>
          </div>
        )}

        {/* Anchor target for sticky CTA's "View Condition Report" link.
            Patch 3 will mount the actual condition report render here. */}
        <div id="condition-report" className="mt-16 scroll-mt-20">
          {product.condition === "used" && (
            <p className="text-xs uppercase tracking-[0.22em] text-ink/40">
              Condition report — coming next session
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
