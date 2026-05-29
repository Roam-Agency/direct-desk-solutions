import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "./_AdminSidebar";

/**
 * Admin layout — wraps all authenticated /admin/* pages.
 *
 * Belt-and-braces: proxy already gates this, but we also check on the
 * server here so any direct render attempt without a session 302s to login.
 *
 * Renders the persistent admin chrome: left sidebar with brand mark,
 * primary nav (with live counts), logged-in user email, and sign-out form.
 * Mobile (<lg): sidebar collapses behind a hamburger off-canvas drawer.
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
    <div className="min-h-screen bg-paper text-ink lg:flex">
      <AdminSidebar userEmail={user.email ?? ""} />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

