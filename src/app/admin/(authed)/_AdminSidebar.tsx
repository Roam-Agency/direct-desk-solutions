import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import logoLight from "@/assets/brand/dds-logo-light.png";
import { MobileDrawerShell, NavItem } from "./_AdminSidebar.client";

/**
 * Persistent left rail nav for the admin app.
 *
 * Server component — fetches sidebar counts in parallel using Supabase
 * `count: "exact", head: true` queries (no row data transferred, just
 * the row count). All four queries run in `Promise.all` so the slowest
 * one bounds the cost, not the sum.
 *
 * Count semantics (best-outcome policy — counts only where the number
 * changes what the admin does next):
 *   - Products: total catalogue size (drafts + live + archived)
 *   - Orders:   "needs attention" = paid_at IS NOT NULL AND fulfilled_at IS NULL
 *               (money's in, not yet shipped). Renders a brand-red dot
 *               next to the label when > 0.
 *   - Categories / Customers: no badge — count doesn't drive action.
 *
 * If the orders attention-filter assumption changes, this is the one
 * place to update.
 */
export async function AdminSidebar({ userEmail }: { userEmail: string }) {
  const supabase = await createClient();

  const [productsResult, ordersAttentionResult] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .not("paid_at", "is", null)
      .is("fulfilled_at", null),
  ]);

  const productsCount = productsResult.count ?? null;
  const ordersAttentionCount = ordersAttentionResult.count ?? null;

  return (
    <MobileDrawerShell>
      <div className="flex h-full min-h-screen flex-col">
        {/* Brand logo (white-on-dark variant for the dark rail) */}
        <div className="border-b border-paper/10 px-5 py-6">
          <Link href="/admin" aria-label="Direct Desk Solutions admin" className="block">
            <Image src={logoLight} alt="Direct Desk Solutions" className="h-8 w-auto" />
          </Link>
          <span className="mt-2 block text-[10px] font-bold uppercase tracking-widest text-paper/40">
            Admin
          </span>
        </div>

        {/* Nav rows */}
        <nav className="flex flex-col py-4">
          <NavItem href="/admin" label="Dashboard" />
          <NavItem
            href="/admin/products"
            label="Products"
            count={productsCount}
          />
          <NavItem href="/admin/categories" label="Categories" />
          <NavItem href="/admin/customers" label="Customers" />
          <NavItem
            href="/admin/orders"
            label="Orders"
            count={ordersAttentionCount}
            showNewDot
          />
        </nav>

        {/* Spacer pushes the user / sign-out block to the bottom */}
        <div className="flex-1" />

        {/* User identity + sign-out */}
        <div className="border-t border-paper/10 px-5 py-4">
          <p className="truncate text-[10px] text-paper/40" title={userEmail}>
            {userEmail}
          </p>
          <form action="/admin/signout" method="post" className="mt-2">
            <button
              type="submit"
              className="text-xs font-bold uppercase tracking-widest text-paper/70 transition hover:text-brand-red"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </MobileDrawerShell>
  );
}
