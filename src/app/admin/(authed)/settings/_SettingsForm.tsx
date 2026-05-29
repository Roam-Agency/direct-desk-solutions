"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { settingsSchema, type SettingsInput } from "@/lib/settings/schema";
import { updateSettings } from "./_actions";
import type { AppSettings } from "@/lib/settings/fetch";

type Props = {
  initialSettings: AppSettings;
};

export function SettingsForm({ initialSettings }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [freeShipping, setFreeShipping] = useState(
    initialSettings.free_shipping_active
  );
  const [freeDeliveryMessage, setFreeDeliveryMessage] = useState(
    initialSettings.free_delivery_message ?? ""
  );
  const [lowStockThreshold, setLowStockThreshold] = useState(
    initialSettings.low_stock_threshold?.toString() ?? "3"
  );
  const [contactEmail, setContactEmail] = useState(
    initialSettings.contact_email ?? ""
  );
  const [warrantyTerms, setWarrantyTerms] = useState(
    initialSettings.default_warranty_terms ?? ""
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setSavedAt(null);

    const input: SettingsInput = {
      free_shipping_active: freeShipping,
      free_delivery_message: freeDeliveryMessage.trim(),
      low_stock_threshold: parseInt(lowStockThreshold, 10) || 0,
      contact_email: contactEmail.trim(),
      default_warranty_terms: warrantyTerms.trim(),
    };

    // Pre-validate client-side for instant feedback.
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors)) {
        if (v && v.length > 0) errs[k] = v[0];
      }
      setFieldErrors(errs);
      return;
    }

    startTransition(async () => {
      const result = await updateSettings(input);
      if (result.ok) {
        setSavedAt(Date.now());
        router.refresh();
      } else {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        if (result.formError) setFormError(result.formError);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {formError && (
        <div className="border-l-4 border-brand-red bg-brand-red/5 px-4 py-3 text-sm text-brand-red">
          {formError}
        </div>
      )}

      <Section
        title="Delivery"
        description="Control site-wide delivery pricing and the promotional message customers see."
      >
        <Field
          label="Site-wide free shipping"
          hint="When on, every order ships free at checkout regardless of basket value. Use this to run free-delivery flash sales, then switch it back off."
        >
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={freeShipping}
              onChange={(e) => setFreeShipping(e.target.checked)}
              className="accent-brand-red"
            />
            <span className="text-sm">
              {freeShipping ? (
                <span className="font-bold text-brand-red">
                  Free shipping is ON — all orders ship free
                </span>
              ) : (
                "Free shipping is off — standard delivery rates apply"
              )}
            </span>
          </label>
        </Field>

        <Field
          label="Free-delivery message"
          error={fieldErrors.free_delivery_message}
          hint="Promotional copy shown to customers (e.g. in the site footer). Leave blank to hide it."
        >
          <input
            type="text"
            value={freeDeliveryMessage}
            onChange={(e) => setFreeDeliveryMessage(e.target.value)}
            placeholder="Free UK delivery on orders over £500"
            className="w-full border border-rule bg-paper px-4 py-3 focus:border-brand-red focus:outline-none"
          />
        </Field>
      </Section>

      <Section
        title="Catalogue"
        description="Defaults that apply across the product catalogue."
      >
        <Field
          label="Low-stock threshold"
          error={fieldErrors.low_stock_threshold}
          hint="Default alert level for products with no per-product threshold set. Products at or below this count appear in the dashboard's low-stock alert."
        >
          <input
            type="number"
            min={0}
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-3 font-mono focus:border-brand-red focus:outline-none"
          />
        </Field>
      </Section>

      <Section
        title="Warranty"
        description="Default warranty terms applied to products and orders."
      >
        <Field
          label="Default warranty terms"
          error={fieldErrors.default_warranty_terms}
          hint="The standard warranty wording used as the default across the catalogue. Leave blank if not applicable."
        >
          <textarea
            value={warrantyTerms}
            onChange={(e) => setWarrantyTerms(e.target.value)}
            rows={4}
            placeholder="12-month warranty on new items, 3-month warranty on refurbished items."
            className="w-full border border-rule bg-paper px-4 py-3 focus:border-brand-red focus:outline-none"
          />
        </Field>
      </Section>

      <Section
        title="Contact"
        description="The public-facing contact details for the store."
      >
        <Field
          label="Contact email"
          error={fieldErrors.contact_email}
          hint="Shown to customers across the site (e.g. the footer)."
          required
        >
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="info@directdesksolutions.com"
            className="w-full border border-rule bg-paper px-4 py-3 focus:border-brand-red focus:outline-none"
          />
        </Field>
      </Section>

      <div className="flex items-center gap-4 border-t border-rule pt-6">
        <button
          type="submit"
          disabled={isPending}
          className="bg-ink px-6 py-3 text-xs font-bold uppercase tracking-widest text-paper transition hover:bg-brand-red disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save settings"}
        </button>
        {savedAt && !isPending && (
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
            Saved
          </span>
        )}
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-6 border-t border-rule pt-8 first:border-t-0 first:pt-0">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink/60">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-xs text-ink/40">{description}</p>
        )}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink">
        {label}
        {required && <span className="ml-1 text-brand-red">*</span>}
      </label>
      {hint && <p className="mb-2 text-xs text-ink/60">{hint}</p>}
      {children}
      {error && <p className="mt-1 text-xs text-brand-red">{error}</p>}
    </div>
  );
}
