import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js proxy: gates /admin/* routes behind Supabase auth.
 *
 * Flow:
 *   1. Refresh the Supabase session on every request (keeps cookies fresh).
 *   2. If the request is for /admin/* AND the user is not signed in,
 *      redirect to /admin/login.
 *   3. If the request is for /admin/login AND the user IS signed in,
 *      redirect to /admin (avoids showing the login form to logged-in users).
 *   4. Otherwise pass through.
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isAdminRoute = pathname.startsWith("/admin");
  const isLoginRoute = pathname === "/admin/login";

  if (isAdminRoute && !isLoginRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (isLoginRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return response;
}

/**
 * Match all routes except static assets, image optimisation, and favicon.
 *
 * The session is refreshed on every matched request, even non-admin ones —
 * this keeps the cookie alive while the user is browsing the customer site,
 * so they don't have to re-login if they switch tabs back to /admin.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
