import type { ReactNode } from "react";
import PublicHeader from "./_PublicHeader";
import PublicFooter from "./_PublicFooter";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
