"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Logo from "./_Logo";

const NAV_LINKS = [
  { href: "/products?condition=new", label: "Shop New" },
  { href: "/products?condition=used", label: "Shop Used" },
  { href: "/brands", label: "Brands" },
];

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
            <Logo size={28} variant="dark" />
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
          </nav>

          {/* Hamburger — mobile + tablet only */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="public-mobile-menu"
            className="lg:hidden flex flex-col gap-[5px] p-2 -mr-2 hover:opacity-70 transition-opacity"
          >
            <span className="block w-6 h-[2px] bg-ink" />
            <span className="block w-6 h-[2px] bg-ink" />
            <span className="block w-6 h-[2px] bg-ink" />
          </button>
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
