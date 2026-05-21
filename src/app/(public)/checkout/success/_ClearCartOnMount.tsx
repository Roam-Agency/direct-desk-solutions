"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/lib/cart/store";

/**
 * Side-effect-only component that clears the buyer's cart once the
 * success page renders. Returns null - no visual output.
 *
 * --- L27 discipline ---
 * No useState in this component. The cart-clear runs once, via a
 * ref-guarded useEffect. setState inside an effect body would
 * trigger React 19's react-hooks/set-state-in-effect lint rule.
 * A ref does not trigger renders and is the canonical "have I done
 * this side-effect yet?" flag.
 *
 * The mounted gate is for SSR safety: the cart store reads
 * localStorage, which only exists in the browser. mounted=true
 * means the cart provider has hydrated and clearCart() is safe to
 * call.
 */
export default function ClearCartOnMount() {
  const { mounted, clearCart } = useCart();
  const clearedRef = useRef(false);

  useEffect(() => {
    if (!mounted) return;
    if (clearedRef.current) return;
    clearedRef.current = true;
    clearCart();
  }, [mounted, clearCart]);

  return null;
}
