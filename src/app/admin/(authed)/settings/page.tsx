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
    </div>
  );
}
