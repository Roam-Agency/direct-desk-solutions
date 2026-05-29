import type { ReactNode } from "react";
import ChromeShell from "./_ChromeShell";
import PublicFooter from "./_PublicFooter";
import { getAppSettings } from "@/lib/settings/fetch";

export default async function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  const settings = await getAppSettings();

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <ChromeShell contactEmail={settings.contact_email}>
        <main className="flex-1">{children}</main>
      </ChromeShell>
      <PublicFooter />
    </div>
  );
}
