import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components (anything with "use client").
 *
 * Uses the PUBLISHABLE key, which is safe to expose in browser code.
 * All access is governed by Row Level Security (RLS) policies on each table.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
