import type { PublishedConditionReport } from "@/lib/products/fetch";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://direct-desk-solutionse.netlify.app";

type ProductForJsonLd = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  sku: string | null;
  condition: "new" | "used";
  condition_grade: "A" | "B" | "C" | null;
  price_pence: number;
  was_price_pence: number | null;
  stock_quantity: number;
};

type ImageForJsonLd = {
  cloudinary_url: string;
  alt_text: string | null;
  is_hero: boolean;
  sort_order: number;
};

type Props = {
  product: ProductForJsonLd;
  images: ImageForJsonLd[];
  conditionReport: PublishedConditionReport | null;
};

/**
 * Renders a Schema.org Product JSON-LD block in a <script> tag.
 * Invisible to users, visible to crawlers. Drives Google's rich
 * product card features in search results.
 *
 * Spec: https://schema.org/Product
 * Google docs: https://developers.google.com/search/docs/appearance/structured-data/product
 *
 * Used items map to RefurbishedCondition (rather than UsedCondition)
 * because that better describes our catalogue — every used item is
 * mechanically serviced + warrantied, not raw second-hand. Schema.org
 * supports both; refurbished is more accurate and gives clearer SERP copy.
 */
export default function ProductJsonLd({ product, images, conditionReport }: Props) {
  const productUrl = `${SITE_URL}/products/${product.slug}`;

  // Image array: hero first, then by sort_order. Use absolute URLs
  // (Cloudinary URLs already are) so crawlers don't have to resolve
  // anything against metadataBase.
  const imageUrls = images
    .slice()
    .sort((a, b) => {
      if (a.is_hero !== b.is_hero) return a.is_hero ? -1 : 1;
      return a.sort_order - b.sort_order;
    })
    .map((img) => img.cloudinary_url);

  const itemCondition =
    product.condition === "used"
      ? "https://schema.org/RefurbishedCondition"
      : "https://schema.org/NewCondition";

  const availability =
    product.stock_quantity > 0
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock";

  // Price in pounds (decimal string). Schema expects the unit price
  // as a number — pence stays as our internal unit, we convert here.
  const priceGbp = (product.price_pence / 100).toFixed(2);

  type AdditionalProperty = { "@type": "PropertyValue"; name: string; value: string };
  const additionalProperty: AdditionalProperty[] = [];

  // Used + grade present → expose grade as additionalProperty
  if (product.condition === "used" && product.condition_grade) {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "Condition grade",
      value: `Grade ${product.condition_grade}`,
    });
  }

  // Published condition report present → expose its summary grade too.
  // This is the report's verdict, distinct from the seller's pre-report
  // grade (they're allowed to differ — see Brief 13 §I).
  if (conditionReport?.report?.grade) {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "Condition report grade",
      value: `Grade ${conditionReport.report.grade}`,
    });
  }

  type Brand = { "@type": "Brand"; name: string };
  type Offer = {
    "@type": "Offer";
    url: string;
    priceCurrency: "GBP";
    price: string;
    availability: string;
    itemCondition: string;
  };
  type JsonLd = {
    "@context": "https://schema.org";
    "@type": "Product";
    name: string;
    description: string;
    url: string;
    image?: string[];
    sku?: string;
    brand?: Brand;
    offers: Offer;
    additionalProperty?: AdditionalProperty[];
  };

  const jsonLd: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description:
      product.description ??
      `${product.name} from Direct Desk Solutions.`,
    url: productUrl,
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "GBP",
      price: priceGbp,
      availability,
      itemCondition,
    },
  };

  if (imageUrls.length > 0) {
    jsonLd.image = imageUrls;
  }

  if (product.sku) {
    jsonLd.sku = product.sku;
  }

  if (product.brand) {
    jsonLd.brand = {
      "@type": "Brand",
      name: product.brand,
    };
  }

  if (additionalProperty.length > 0) {
    jsonLd.additionalProperty = additionalProperty;
  }

  return (
    <script
      type="application/ld+json"
      // Schema.org JSON-LD is content for crawlers, not user-facing.
      // dangerouslySetInnerHTML is the documented pattern from Next docs.
      // We control the source object so XSS isn't a vector here.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
