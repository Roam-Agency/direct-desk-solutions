import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Direct Desk Solutions",
  description:
    "A smarter source for office furniture. New and pre-owned desks, chairs, storage, and more — delivered across the UK.",
};

export default function PublicHomePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24 sm:py-32">
      <p className="text-xs uppercase tracking-[0.22em] text-brand-red font-bold mb-6">
        Phase 3 — coming online
      </p>
      <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight mb-6">
        A smarter source for office furniture.
      </h1>
      <p className="text-base leading-relaxed text-ink/70 mb-10 max-w-xl">
        New and pre-owned office furniture, delivered across the UK.
        Our new home is being built — product browsing and full ordering
        coming soon.
      </p>
      <a
        href="mailto:info@directdesksolutions.com"
        className="inline-block text-xs uppercase tracking-[0.18em] font-bold border-b-2 border-ink pb-1 hover:opacity-70 transition-opacity"
      >
        info@directdesksolutions.com
      </a>
    </div>
  );
}
