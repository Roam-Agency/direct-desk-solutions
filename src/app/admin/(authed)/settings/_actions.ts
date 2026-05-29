"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { settingsSchema, type SettingsInput } from "@/lib/settings/schema";

/**
 * Server Action for editing the singleton app_settings row (id = 1).
 *
 * Lives under the (authed) group so middleware + layout have already
 * confirmed an authenticated session before this executes.
 *
 * Return shape (discriminated union, matches categories/_actions.ts):
 *   { ok: true }
 *   { ok: false, fieldErrors?: Record<string, string>, formError?: string }
 */

type ActionResult =
  | { ok: true }
  | {
      ok: false;
      fieldErrors?: Record<string, string>;
      formError?: string;
    };

function zodErrorsToFieldErrors(
  fieldErrors: Record<string, string[] | undefined>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (messages && messages.length > 0) {
      result[key] = messages[0];
    }
  }
  return result;
}

export async function updateSettings(
  input: SettingsInput
): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: zodErrorsToFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const supabase = await createClient();

  // Stamp who made the change, when available. Anonymous-but-authed edge
  // cases just leave updated_by null.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Upsert the singleton (id = 1). Upsert rather than update so a fresh
  // environment whose row hasn't been seeded still works. The DB check
  // constraint pins id = 1.
  const { error } = await supabase.from("app_settings").upsert(
    {
      id: 1,
      free_shipping_active: parsed.data.free_shipping_active,
      free_delivery_message: parsed.data.free_delivery_message,
      low_stock_threshold: parsed.data.low_stock_threshold,
      contact_email: parsed.data.contact_email,
      default_warranty_terms: parsed.data.default_warranty_terms,
      updated_by: user?.id ?? null,
    },
    { onConflict: "id" }
  );

  if (error) {
    return { ok: false, formError: error.message };
  }

  // Settings ripple across the whole site: checkout shipping, the dashboard
  // low-stock count, and the public footer all read app_settings.
  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/", "layout");

  return { ok: true };
}
