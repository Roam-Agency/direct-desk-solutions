import { getAppSettings } from "@/lib/settings/fetch";
import { SettingsForm } from "./_SettingsForm";

export const metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const settings = await getAppSettings();

  return (
    <div className="space-y-10">
      <div className="border-b-2 border-ink pb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-ink/40">
          Admin
        </p>
        <h1 className="mt-1 text-4xl font-black tracking-tight">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/60">
          Store-wide settings. Changes apply immediately — free shipping
          affects the live checkout, and the contact details and delivery
          message update across the customer-facing site.
        </p>
      </div>

      <div className="max-w-2xl">
        <SettingsForm initialSettings={settings} />
      </div>

      {/* Claude AI — the dashboard uses Claude to generate product metadata
          from photos. This card gives the admin a quick route to top up
          credits or manage their plan when usage runs low. Informational
          only (external links), so it lives outside the settings form. */}
      <div className="max-w-2xl border-t border-rule pt-8">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink/60">
          Claude AI
        </h2>
        <p className="mt-1 text-xs text-ink/40">
          The dashboard uses Claude to auto-fill product details from photos.
          If AI suggestions stop working you may be out of credits — top up or
          manage your plan below.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="https://claude.ai/settings/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-ink px-5 py-3 text-xs font-bold uppercase tracking-widest text-paper transition hover:bg-brand-red"
          >
            Buy credits / billing ↗
          </a>
          <a
            href="https://claude.ai/upgrade"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-rule px-5 py-3 text-xs font-bold uppercase tracking-widest text-ink/60 transition hover:border-ink hover:text-ink"
          >
            Plans &amp; subscriptions ↗
          </a>
        </div>
      </div>
    </div>
  );
}
