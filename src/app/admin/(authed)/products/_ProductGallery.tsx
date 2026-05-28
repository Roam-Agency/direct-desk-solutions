import Link from "next/link";
import { formatPence } from "@/lib/products/format";
import { StatusPill } from "../_ui/StatusPill";
import type { Database } from "@/types/database";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

/**
 * Cloudinary transform for gallery cards. Square 600x600 (2x for retina
 * on a card that displays ~300px wide at most). Falls through to the
 * untransformed URL if the /upload/ marker is missing.
 */
function toGalleryThumbUrl(url: string): string {
  return url.replace(
    "/upload/",
    "/upload/c_fill,w_600,h_600,q_auto,f_auto/"
  );
}

/**
 * Visual gallery view of the products list. Each card is a square hero
 * with name + status + price. Clicking anywhere on the card opens that
 * product's edit page.
 *
 * Grid: 1 col on mobile, 2 on sm, 3 on lg. Matches the dashboard's
 * recent-activity columns visually.
 */
export function ProductGallery({
  rows,
  heroByProductId,
}: {
  rows: ProductRow[];
  heroByProductId: Map<string, { url: string; alt: string | null }>;
}) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => {
        const hero = heroByProductId.get(row.id) ?? null;
        const label =
          row.status === "live"
            ? "Live"
            : row.status === "draft"
            ? "Draft"
            : "Archived";
        return (
          <li key={row.id} className="border border-rule bg-paper">
            <Link
              href={`/admin/products/${row.id}`}
              className="block transition hover:border-ink"
            >
              <div className="relative aspect-square overflow-hidden border-b border-rule bg-rule/30">
                {hero ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={toGalleryThumbUrl(hero.url)}
                    alt={hero.alt ?? row.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    aria-hidden
                  >
                    <span className="text-xs font-bold uppercase tracking-widest text-ink/30">
                      No photo
                    </span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="font-mono text-xs text-ink/50">{row.sku}</p>
                <p className="mt-1 truncate font-bold text-ink">{row.name}</p>
                <div className="mt-2 flex items-center justify-between">
                  <StatusPill tone={row.status}>{label}</StatusPill>
                  <span className="font-bold tabular-nums text-ink">
                    {formatPence(row.price_pence)}
                  </span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
