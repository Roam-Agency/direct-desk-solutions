import { createServerClient } from "@supabase/ssr";
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
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // no-op: admin client doesn't track sessions
        },
      },
    }
  );
}
