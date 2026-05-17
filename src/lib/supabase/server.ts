import { createServerClient } from "@supabase/ssr";
import { createClient as createBareClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Supabase client for use in Server Components, Server Actions, and Route Handlers.
 *
 * Uses the PUBLISHABLE key by default — same permissions as the browser client,
 * governed by Row Level Security policies. Reads cookies so the logged-in user's
 * session is respected.
 *
 * For admin operations that need to bypass RLS (e.g. server-side writes during
 * webhook processing), see `createAdminClient()` below.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if middleware refreshes user sessions.
          }
        },
      },
    }
  );
}

/**
 * Admin Supabase client — uses the SECRET key, bypasses Row Level Security.
 *
 * Only call this from trusted server contexts (Route Handlers, Server Actions).
 * NEVER expose to client code. NEVER use the SECRET key in a NEXT_PUBLIC_* var.
 */
export function createAdminClient() {
  // We use the bare `@supabase/supabase-js` client here, NOT `@supabase/ssr`,
  // because the SSR wrapper is designed around cookie-bound user sessions and
  // routes its requests through the GoTrue authorization layer. With new-format
  // service-role keys (`sb_secret_*`) the SSR wrapper's auth handling does NOT
  // correctly identify the request as service-role, so RLS is still enforced
  // and queries against locked-down tables (e.g. upload_tokens) silently
  // return zero rows.
  //
  // The bare client just sends the key as the `apikey` and `Authorization:
  // Bearer` headers without any session handling, which is exactly what
  // service-role usage requires. We also explicitly disable session
  // persistence + auto-refresh, which would otherwise try to manage tokens
  // on the server (where there's no browser storage anyway).
  return createBareClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
