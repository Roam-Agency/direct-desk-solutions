import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPence } from "@/lib/products/format";
import { SectionHeader } from "./_ui/SectionHeader";
import { StatCard } from "./_ui/StatCard";
import { StatusPill } from "./_ui/StatusPill";
import { DashboardDropZone } from "./_DashboardDropZone";

/**
 * Admin dashboard — daily-driver landing page.
 *
 * Three blocks, top to bottom:
 *   A — Photo drop zone (DashboardDropZone): primary "add product" entry.
 *   B — 4-up catalogue stats (live, drafts, used-in-stock, low-stock alerts).
 *   C — Two-column recent activity (last 5 edited products + last 5 orders).
 *
 * All Supabase queries run in parallel via Promise.all so the slowest one
 * bounds the response time, not the sum. Stats are derived in JS from a
 * single small product set — at low-tens catalogue scale that beats
 * four separate count(*) queries.
 */

type ProductStatus = "live" | "draft" | "archived";

/**
 * Compact human-readable "time ago" for activity feed rows.
 * Renders just-now / Nm / Nh / Nd / Nw / Nmo / Ny.
 */
function formatTimeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 4) return `${wk}w ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}

/**
 * Cloudinary URL transform — fetch a 96x96 thumbnail (2x for retina)
 * instead of the full hero. Defensive: returns the original URL if the
 * /upload/ marker is missing.
 */
function toThumbUrl(url: string): string {
  return url.replace("/upload/", "/upload/c_fill,w_96,h_96,q_auto,f_auto/");
}

export default async function AdminDashboard() {
  const supabase = await createClient();

  // Parallel queries: stats set, recent products, recent orders.
  // Heroes for the recent products column come in a second round-trip
  // (depends on the recent-products result).
  const [productsForStatsRes, recentProductsRes, recentOrdersRes] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, status, condition, stock_quantity, low_stock_alert"),
      supabase
        .from("products")
        .select("id, name, status, updated_at")
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase
        .from("orders")
        .select(
          "id, status, total_pence, created_at, customer:customers(first_name, last_name, email)"
        )
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const productsForStats = productsForStatsRes.data ?? [];
  const recentProducts = recentProductsRes.data ?? [];
  const recentOrdersRaw = recentOrdersRes.data ?? [];

  // Derive stats in a single pass. Low-stock semantics: only count
  // products that have a threshold set (low_stock_alert IS NOT NULL).
  let liveCount = 0;
  let draftCount = 0;
  let usedInStockCount = 0;
  let lowStockCount = 0;
  for (const p of productsForStats) {
    if (p.status === "live") liveCount++;
    if (p.status === "draft") draftCount++;
    if (p.condition === "used" && p.stock_quantity > 0) usedInStockCount++;
    if (
      p.low_stock_alert !== null &&
      p.stock_quantity <= p.low_stock_alert
    ) {
      lowStockCount++;
    }
  }

  // Hero images for the recent products column.
  const productIds = recentProducts.map((p) => p.id);
  const heroByProductId = new Map<
    string,
    { url: string; alt: string | null }
  >();
  if (productIds.length > 0) {
    const { data: heroes } = await supabase
      .from("product_images")
      .select("product_id, cloudinary_url, alt_text")
      .in("product_id", productIds)
      .eq("is_hero", true);
    for (const h of heroes ?? []) {
      heroByProductId.set(h.product_id, {
        url: h.cloudinary_url,
        alt: h.alt_text,
      });
    }
  }

  // Normalise the recent-orders customer embed. Supabase-js can return
  // foreign-key embeds as either a single object or a single-element
  // array depending on inferred cardinality — handle both defensively.
  const recentOrders: RecentOrderRow[] = recentOrdersRaw.map((row) => {
    const rawCustomer = row.customer as
      | { first_name: string | null; last_name: string | null; email: string }
      | { first_name: string | null; last_name: string | null; email: string }[]
      | null;
    const customer = Array.isArray(rawCustomer)
      ? rawCustomer[0] ?? null
      : rawCustomer;
    return {
      id: row.id,
      status: row.status,
      total_pence: row.total_pence,
      created_at: row.created_at,
      customer,
    };
  });

  return (
    <div>
      <SectionHeader eyebrow="Admin" title="Dashboard" />

      {/* Block A — Photo drop zone */}
      <div className="mt-8">
        <DashboardDropZone />
      </div>

      {/* Block B — 4-up stats */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Live products"
          value={liveCount}
          href="/admin/products?status=live"
        />
        <StatCard
          label="Drafts"
          value={draftCount}
          href="/admin/products?status=draft"
        />
        <StatCard
          label="Used in stock"
          value={usedInStockCount}
          href="/admin/products?condition=used"
        />
        <StatCard
          label="Low-stock alerts"
          value={lowStockCount}
          href="/admin/products"
          sublabel={lowStockCount > 0 ? "Below threshold" : undefined}
        />
      </div>

      {/* Block C — Recent activity */}
      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <RecentProductsColumn
          rows={recentProducts as RecentProductRow[]}
          heroByProductId={heroByProductId}
        />
        <RecentOrdersColumn rows={recentOrders} />
      </div>
    </div>
  );
}

type RecentProductRow = {
  id: string;
  name: string;
  status: ProductStatus;
  updated_at: string;
};

function RecentProductsColumn({
  rows,
  heroByProductId,
}: {
  rows: RecentProductRow[];
  heroByProductId: Map<string, { url: string; alt: string | null }>;
}) {
  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-widest text-ink/60">
        Recently edited products
      </h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink/50">
          No products yet — drop a photo above to get started.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-rule border border-rule">
          {rows.map((row) => {
            const hero = heroByProductId.get(row.id);
            return (
              <li key={row.id}>
                <Link
                  href={`/admin/products/${row.id}`}
                  className="flex items-center gap-4 p-3 transition hover:bg-rule/30"
                >
                  {hero ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={toThumbUrl(hero.url)}
                      alt={hero.alt ?? row.name}
                      width={48}
                      height={48}
                      className="h-12 w-12 border border-rule object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="h-12 w-12 border border-rule bg-rule/40"
                      aria-hidden
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">{row.name}</p>
                    <p className="mt-0.5 text-xs text-ink/50">
                      Edited {formatTimeAgo(row.updated_at)}
                    </p>
                  </div>
                  <StatusPill tone={row.status}>{row.status}</StatusPill>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type RecentOrderRow = {
  id: string;
  status: string;
  total_pence: number;
  created_at: string;
  customer: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
};

function RecentOrdersColumn({ rows }: { rows: RecentOrderRow[] }) {
  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-widest text-ink/60">
        Recent orders
      </h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink/50">No orders yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-rule border border-rule">
          {rows.map((row) => {
            const customerName = row.customer
              ? [row.customer.first_name, row.customer.last_name]
                  .filter(Boolean)
                  .join(" ") || row.customer.email
              : "Guest";
            const orderShort = row.id.slice(0, 8).toUpperCase();
            return (
              <li key={row.id}>
                <Link
                  href={`/admin/orders/${row.id}`}
                  className="flex items-center gap-4 p-3 transition hover:bg-rule/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2">
                      <span className="font-mono text-xs text-ink/50">
                        #{orderShort}
                      </span>
                      <span className="truncate font-bold text-ink">
                        {customerName}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink/50">
                      Placed {formatTimeAgo(row.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-bold tabular-nums text-ink">
                      {formatPence(row.total_pence)}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-ink/50">
                      {row.status}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
