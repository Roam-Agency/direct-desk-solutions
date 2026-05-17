import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Session-refreshing helper for Next.js middleware.
 *
 * Creates a Supabase client wired to read/write cookies on the request/response
 * pair, calls getUser() to refresh the session, and returns:
 *   - the (possibly mutated) response with refreshed auth cookies
 *   - the current user (or null if not signed in)
 *
 * The caller decides what to do with the user — typically: redirect to /admin/login
 * if the request is for /admin/* and user is null.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() — not getSession() — because getUser() revalidates
  // the JWT against Supabase's auth server. getSession() trusts the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
