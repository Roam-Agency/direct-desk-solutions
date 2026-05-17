import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /admin/signout
 *
 * Signs the user out of Supabase, clearing the session cookies,
 * then redirects to the login page.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = new URL("/admin/login", request.url);
  return NextResponse.redirect(url, { status: 303 });
}
