// PR1_HEADER_SEARCH_ICON_AND_RESPONSIVE_LOGO
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Logo from "./_Logo";

const NAV_LINKS = [
  { href: "/products/new", label: "Shop New" },
  { href: "/products/used", label: "Shop Used" },
  { href: "/brands", label: "Brands" },
];

// Reusable magnifying-glass icon. 24px square; stroke inherits via
// currentColor so the desktop variant can pick up ink + hover red,
// and the mobile variant keeps ink to match the hamburger bars.
function SearchIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20L16 16" strokeLinecap="square" />
    </svg>
  );
}

export default function PublicHeader() {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Lock body scroll while menu is open
  useEffect(() => {
    if (open) {
      document.documentElement.style.overflow = "hidden";
      // Defer focus to next tick so the panel is mounted
      const t = setTimeout(() => closeButtonRef.current?.focus(), 0);
      return () => {
        clearTimeout(t);
        document.documentElement.style.overflow = "";
      };
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 bg-paper border-b border-rule">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link href="/" aria-label="Direct Desk Solutions home" className="block">
            {/* Responsive logo sizing via arbitrary-variant child selectors.
                Base 28px (mobile), 36px from md, 40px from lg. width:auto lets
                the SVG's 340:110 intrinsic aspect ratio hold. */}
            <span className="block [&>svg]:h-7 md:[&>svg]:h-9 lg:[&>svg]:h-10 [&>svg]:w-auto">
              <Logo size={28} variant="dark" />
            </span>
          </Link>
          {/* Desktop horizontal nav at lg+. Hidden below. */}
          <nav
            aria-label="Primary"
            className="hidden lg:flex items-center gap-10"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[11px] uppercase tracking-[0.22em] font-bold text-ink hover:text-brand-red transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/search"
              aria-label="Search products"
              className="text-ink hover:text-brand-red transition-colors -mr-2 p-2"
            >
              <SearchIcon />
            </Link>
          </nav>

          {/* Mobile/tablet right-side cluster: search + hamburger */}
          <div className="flex items-center gap-1 lg:hidden">
            <Link
              href="/search"
              aria-label="Search products"
              className="text-ink hover:opacity-70 transition-opacity p-2"
            >
              <SearchIcon />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="public-mobile-menu"
              className="flex flex-col gap-[5px] p-2 -mr-2 hover:opacity-70 transition-opacity"
            >
              <span className="block w-6 h-[2px] bg-ink" />
              <span className="block w-6 h-[2px] bg-ink" />
              <span className="block w-6 h-[2px] bg-ink" />
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div
          id="public-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          className="fixed inset-0 z-50 bg-ink text-white flex flex-col"
        >
          <div className="px-6 h-16 flex items-center justify-between border-b border-white/10 flex-shrink-0">
            <Logo size={28} variant="light" />
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="p-2 -mr-2 hover:opacity-70 transition-opacity"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M6 6L18 18M6 18L18 6" strokeLinecap="square" />
              </svg>
            </button>
          </div>
          <nav className="flex-1 flex flex-col justify-center px-6 -mt-16">
            <ul className="flex flex-col gap-8">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block text-3xl font-black uppercase tracking-tight hover:text-brand-red transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="px-6 py-8 border-t border-white/10 flex-shrink-0">
            <a
              href="mailto:info@directdesksolutions.com"
              className="text-xs uppercase tracking-[0.18em] font-bold border-b-2 border-white pb-1"
            >
              info@directdesksolutions.com
            </a>
          </div>
        </div>
      )}
    </>
  );
}
