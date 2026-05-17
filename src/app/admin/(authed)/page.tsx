import Link from "next/link";

/**
 * Admin dashboard landing page.
 *
 * Placeholder for now — real dashboard (orders summary, low stock alerts,
 * recent activity) comes in a later phase. For now: quick links to the
 * tools that exist.
 */
export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
      <p className="mt-2 text-sm text-ink/60">
        Welcome back. Pick a tool to get started.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/test"
          className="group border border-rule bg-paper p-6 transition hover:border-ink"
        >
          <div className="text-xs font-bold uppercase tracking-widest text-ink/60 group-hover:text-brand-red">
            Diagnostic
          </div>
          <div className="mt-2 text-lg font-bold">Products test page</div>
          <p className="mt-1 text-sm text-ink/60">
            Live DB read of the products table. Sanity check.
          </p>
        </Link>
      </div>
    </div>
  );
}
