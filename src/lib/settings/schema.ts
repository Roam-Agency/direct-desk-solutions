import { z } from "zod";

/**
 * App settings schema — the single source of truth for editable store-wide
 * settings.
 *
 * Used by:
 *   - updateSettings Server Action (validates submitted form data)
 *   - <SettingsForm> component (derives the form's TypeScript types)
 *
 * Backs the singleton `app_settings` row (id = 1). `default_warranty_terms`
 * lives on the table but is not yet surfaced in the UI, so it is intentionally
 * absent here — updates leave its stored value untouched.
 */

export const settingsSchema = z.object({
  // Site-wide free-delivery master switch (flash sales). Read by checkout.
  free_shipping_active: z.boolean().default(false),

  // Promotional copy shown to customers (e.g. in the footer).
  free_delivery_message: z
    .string()
    .trim()
    .max(200, "Keep the message under 200 characters")
    .default(""),

  // Default low-stock threshold for products with no per-product alert set.
  low_stock_threshold: z.coerce
    .number()
    .int("Must be a whole number")
    .min(0, "Cannot be negative")
    .max(10000)
    .default(3),

  // Public-facing contact address.
  contact_email: z
    .string()
    .trim()
    .min(1, "Contact email is required")
    .email("Enter a valid email address")
    .max(200),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
