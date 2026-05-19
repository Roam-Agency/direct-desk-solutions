import Logo from "./_Logo";

export default function PublicFooter() {
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Logo size={28} variant="light" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-stone-400">
              New and pre-owned office furniture, delivered across the UK.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-xs uppercase tracking-[0.18em] sm:items-end">
            <a
              href="mailto:info@directdesksolutions.com"
              className="font-bold border-b-2 border-white pb-1 hover:opacity-70 transition-opacity self-start sm:self-auto"
            >
              info@directdesksolutions.com
            </a>
            <p className="text-[10px] tracking-[0.2em] text-stone-600">
              © 2026 Direct Desk Solutions Ltd
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
