"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

/**
 * Context exposes a `close()` function from MobileDrawerShell down to
 * every NavItem rendered inside it. Closing the drawer when a nav
 * item is clicked is the React-19-friendly way to do "close on
 * navigate" — we close on user intent rather than syncing React state
 * to pathname changes (which the lint rules forbid).
 *
 * The default no-op is what desktop renders see: there's no drawer to
 * close, so calling `close()` from a NavItem does nothing harmful.
 */
const DrawerCloseContext = createContext<() => void>(() => {});

/**
 * Single navigation row inside the sidebar.
 *
 * Active-state rule:
 *  - exact match on `/admin` (so the Dashboard row only lights up there)
 *  - prefix match for everything else (so `/admin/products/abc`
 *    highlights Products)
 *
 * Visual: brand-red left-border accent + paper text on active,
 * ink/50 paper text with hover-to-paper on inactive. Hard-edged,
 * no rounded backgrounds.
 */
export function NavItem({
  href,
  label,
  count,
  showNewDot = false,
}: {
  href: string;
  label: string;
  count?: number | null;
  showNewDot?: boolean;
}) {
  const pathname = usePathname();
  const close = useContext(DrawerCloseContext);
  const isActive =
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={close}
      className={
        isActive
          ? "flex items-center justify-between border-l-2 border-brand-red bg-ink px-5 py-3 text-xs font-bold uppercase tracking-widest text-paper"
          : "flex items-center justify-between border-l-2 border-transparent px-5 py-3 text-xs font-bold uppercase tracking-widest text-paper/50 transition hover:border-paper/30 hover:text-paper"
      }
    >
      <span className="flex items-center gap-2">
        {label}
        {showNewDot && count != null && count > 0 ? (
          <span
            className="inline-block h-1.5 w-1.5 bg-brand-red"
            aria-label={`${count} new`}
          />
        ) : null}
      </span>
      {count != null ? (
        <span
          className={
            isActive
              ? "text-xs font-bold tabular-nums text-paper/80"
              : "text-xs font-bold tabular-nums text-paper/30"
          }
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Mobile drawer wrapper. On mobile (<lg), hides the sidebar behind a
 * hamburger button. Tapping the button slides the full sidebar in
 * from the left as an off-canvas panel with a dimming backdrop.
 *
 * Closes on:
 *   - tapping the backdrop
 *   - pressing Escape (a11y)
 *   - clicking a NavItem (via DrawerCloseContext)
 *
 * Locks body scroll while open so the page underneath does not move.
 *
 * Server-rendered sidebar contents are passed as children so we do
 * not re-fetch counts on the client.
 */
export function MobileDrawerShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  // Single effect for all "drawer is open" DOM side-effects:
  // body-scroll-lock + Escape-key-to-close. Both touch external
  // systems (document, window), which is exactly what effects are for.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <DrawerCloseContext.Provider value={close}>
      {/* Mobile top bar with hamburger — hidden on lg+ */}
      <div className="flex items-center justify-between border-b border-rule bg-ink px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center text-paper"
          aria-label="Open navigation"
        >
          <svg
            width="20"
            height="14"
            viewBox="0 0 20 14"
            fill="none"
            aria-hidden
          >
            <rect width="20" height="2" fill="currentColor" />
            <rect y="6" width="20" height="2" fill="currentColor" />
            <rect y="12" width="20" height="2" fill="currentColor" />
          </svg>
        </button>
        <span className="flex items-baseline gap-0">
          <span className="text-base font-black tracking-tight text-paper">
            Direct Desk
          </span>
          <span className="text-base font-black tracking-tight text-brand-red">
            .
          </span>
        </span>
        <span className="h-9 w-9" aria-hidden />
      </div>

      {/* Backdrop */}
      {open ? (
        <button
          type="button"
          onClick={close}
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-ink/60 lg:hidden"
        />
      ) : null}

      {/* Sidebar panel.
          - lg+: static left rail (always visible, 240px)
          - <lg: off-canvas drawer, slides in when `open` is true */}
      <aside
        className={
          (open
            ? "fixed inset-y-0 left-0 z-50 w-[260px] translate-x-0"
            : "fixed inset-y-0 left-0 z-50 w-[260px] -translate-x-full") +
          " bg-ink transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-60 lg:translate-x-0 lg:transition-none"
        }
      >
        {children}
      </aside>
    </DrawerCloseContext.Provider>
  );
}
