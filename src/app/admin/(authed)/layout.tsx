import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin layout — wraps all authenticated /admin/* pages.
 *
 * Belt-and-braces: proxy already gates this, but we also check on the
 * server here so any direct render attempt without a session 302s to login.
 *
 * Renders the persistent admin chrome: thin top bar with brand mark,
 * primary nav, logged-in user email, and sign-out form.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-rule bg-paper">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-10">
            <Link href="/admin" className="flex items-baseline gap-0">
              <span className="text-lg font-black tracking-tight">
                Direct Desk
              </span>
              <span className="text-lg font-black tracking-tight text-brand-red">
                .
              </span>
              <span className="ml-3 text-xs font-bold uppercase tracking-widest text-ink/60">
                Admin
              </span>
            </Link>

            <nav className="flex items-center gap-6">
              <Link
                href="/admin/products"
                className="text-xs font-bold uppercase tracking-widest text-ink transition hover:text-brand-red"
              >
                Products
              </Link>
              <Link
                href="/admin/categories"
                className="text-xs font-bold uppercase tracking-widest text-ink transition hover:text-brand-red"
              >
                Categories
              </Link>
              <Link
                href="/admin/customers"
                className="text-xs font-bold uppercase tracking-widest text-ink transition hover:text-brand-red"
              >
                Customers
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-6">
            <span className="hidden text-xs text-ink/60 sm:inline">
              {user.email}
            </span>
            <form action="/admin/signout" method="post">
              <button
                type="submit"
                className="text-xs font-bold uppercase tracking-widest text-ink transition hover:text-brand-red"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}

