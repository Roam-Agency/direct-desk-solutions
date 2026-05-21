import type { ReactNode } from "react";
import ChromeShell from "./_ChromeShell";
import PublicFooter from "./_PublicFooter";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <ChromeShell>
        <main className="flex-1">{children}</main>
      </ChromeShell>
      <PublicFooter />
    </div>
  );
}
