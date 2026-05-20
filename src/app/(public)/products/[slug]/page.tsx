import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getProductBySlug,
  getProductImages,
  getPublishedConditionReport,
} from "@/lib/products/fetch";
import Breadcrumb from "../../_Breadcrumb";
import Gallery from "./_Gallery";
import PriceBlock from "./_PriceBlock";
import StockBadge from "./_StockBadge";
import TrustBullets from "./_TrustBullets";
import StickyCTA from "./_StickyCTA";
import ConditionReport from "./_ConditionReport";

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

  // Pull the hero image to use in social unfurls. Falls back to the
  // default OG image if the product has no hero attached yet.
  const images = await getProductImages(product.id);
  const hero = images.find((img) => img.is_hero) ?? images[0];
  const ogImage = hero?.cloudinary_url ?? "/og-default.png";
  const ogAlt = hero?.alt_text ?? product.name;

  const title = `${product.name}${product.brand ? ` — ${product.brand}` : ""}`;
  const description =
    product.description ??
    `${product.name} from Direct Desk Solutions. New and pre-owned office furniture, delivered across the UK.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: ogImage,
          alt: ogAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  // Fetch images and condition report in parallel — both are independent
  // reads off the product id and don't block each other.
  const [images, conditionReport] = await Promise.all([
    getProductImages(product.id),
    getPublishedConditionReport(product.id),
  ]);

  const hasPublishedReport = conditionReport !== null;

  // Determine breadcrumb based on condition. We don't have category
  // lookup wired into v1 because category landing pages don't exist
  // yet (Session 4 work). The middle crumb is intentionally absent.
  const conditionCrumb =
    product.condition === "used"
      ? { label: "Shop Used", href: "/products?condition=used" }
      : { label: "Shop New", href: "/products?condition=new" };

  return (
    <>
      {/* pb-32 reserves space at the bottom so the sticky CTA bar never
          overlaps page content at scroll end. ~128px covers single-row
          CTA on tablet/desktop and CTA + mobile anchor link on phones. */}
      <div className="pb-32 lg:pb-16">
        <div className="mx-auto max-w-7xl px-6 pt-6">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              conditionCrumb,
              { label: product.name },
            ]}
          />
        </div>

        {/* Hero region: at lg+ the gallery and product info sit side by
            side in a 7/5 split. Below lg, both stack full-width as
            shipped in Session 2. The grid wrapper applies only at lg+
            so mobile/tablet behaviour is unchanged. */}
        <div className="mx-auto max-w-7xl lg:px-6 lg:mt-6">
          <div className="lg:grid lg:grid-cols-12 lg:gap-10">
            {/* Gallery column */}
            <div className="lg:col-span-7">
              {/* Gallery: scroll-snap carousel on mobile, thumb-strip +
                  main image on desktop. Same component, both DOMs,
                  Tailwind hides the wrong one per breakpoint. */}
              <Gallery
                images={images}
                condition={product.condition}
                grade={product.condition_grade}
                productName={product.name}
              />
            </div>

            {/* Info column */}
            <div className="px-6 lg:px-0 lg:col-span-5">
              {/* Product identity */}
              <div className="mt-8 lg:mt-0 space-y-3">
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

              {/* Desktop-inline CTA — replaces the mobile sticky bar at
                  lg+. Sits inside the info column, below the trust
                  bullets. Mobile sticky bar still renders at the bottom
                  of the page (see <StickyCTA variant="mobile-sticky" />
                  outside the wrapper). */}
              <div className="mt-10 hidden lg:block">
                <StickyCTA
                  pricePence={product.price_pence}
                  hasPublishedReport={hasPublishedReport}
                  variant="desktop-inline"
                />
              </div>
            </div>
          </div>

          {/* Description + condition report break out below the grid at
              a comfortable reading width. Centred within max-w-7xl. */}
          <div className="px-6 lg:px-0 lg:max-w-3xl lg:mx-auto">
            {/* Description */}
            {product.description && (
              <div className="mt-10 lg:mt-16">
                <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-brand-red mb-3">
                  About this {product.condition === "used" ? "piece" : "product"}
                </p>
                <div className="prose prose-sm max-w-none text-ink leading-relaxed whitespace-pre-line">
                  {product.description}
                </div>
              </div>
            )}

            {/* Condition report — only when a published report exists for
                this product. Anchor target for the sticky CTA's "View
                Condition Report" link. scroll-mt-20 offsets the sticky
                header so the anchor scroll doesn't land under it. */}
            <div id="condition-report" className="mt-16 scroll-mt-20">
              {conditionReport && (
                <ConditionReport
                  report={conditionReport}
                  productCondition={product.condition}
                  productName={product.name}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky CTA bar — rendered outside the pb-32 wrapper so it sits
          above page content as a fixed overlay. */}
      <StickyCTA
        pricePence={product.price_pence}
        hasPublishedReport={hasPublishedReport}
      />
    </>
  );
}
