"use client";

import type { ReactNode } from "react";
import { CartProvider } from "@/lib/cart/store";
import PublicHeader from "./_PublicHeader";
import CartDrawer from "./_CartDrawer";

/**
 * Client-side chrome wrapper for the (public) layout.
 *
 * The layout itself is a server component (PublicLayout in layout.tsx).
 * The CartProvider needs to wrap everything that consumes cart context:
 *   - the header (for the basket icon + count badge)
 *   - the drawer (which lives at root-of-layout so it overlays content)
 *   - the page main content (so sticky CTA can dispatch addItem)
 *
 * This wrapper does exactly that. PublicFooter stays outside, in the
 * server component, because the footer has no cart-aware UI.
 *
 * The children prop renders the page's <main> element — the layout
 * passes <main className="flex-1">{children}</main> through this
 * wrapper.
 */
export default function ChromeShell({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <PublicHeader />
      {children}
      <CartDrawer />
    </CartProvider>
  );
}
