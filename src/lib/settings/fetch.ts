import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type AppSettings = Database["public"]["Tables"]["app_settings"]["Row"];

/**
 * Fallback settings. Mirror the column defaults in migration 0012 so the site
 * behaves identically whether or not the singleton row has been read yet (e.g.
 * a transient DB error, or the row not seeded in a fresh environment).
 *
 * The free-delivery defaults match the previously hardcoded contact address
 * and shipping copy, so nothing changes until an admin edits the settings.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  id: 1,
  free_shipping_active: false,
  free_delivery_message: "Free UK delivery on orders over £500",
  low_stock_threshold: 3,
  contact_email: "info@directdesksolutions.com",
  default_warranty_terms: "",
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

/**
 * Read the singleton app_settings row (id = 1).
 *
 * Always returns a usable settings object: on any error or missing row it
 * falls back to DEFAULT_SETTINGS rather than throwing, so callers (checkout,
 * footer, dashboard) never have to special-case a null.
 *
 * Readable by anonymous users via RLS — safe to call from public pages and
 * the checkout flow.
 */
export async function getAppSettings(): Promise<AppSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return DEFAULT_SETTINGS;
  return data;
}
