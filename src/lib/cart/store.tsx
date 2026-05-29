"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import type {
  CartAction,
  CartItem,
  CartState,
} from "./types";
import { cartItemCount, cartTotalPence } from "./format";

const STORAGE_KEY = "dds-cart-v1";

const INITIAL_STATE: CartState = {
  items: [],
  mounted: false,
};

/**
 * Reducer. Pure function; no side effects. localStorage persistence
 * is handled by an effect in the provider, not here.
 *
 * One-of-one guard: ADD for a used item with qty>1 collapses to qty=1.
 * Re-adding a used item that's already in the cart no-ops (returns
 * state unchanged). Re-adding a new item bumps qty, clamped at the
 * line's stockAtAdd.
 */
function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "HYDRATE":
      return { items: action.items, mounted: true };

    case "ADD": {
      const incoming = action.item;
      const requestedQty = action.item.qty ?? 1;
      const clampedQty = incoming.condition === "used" ? 1 : requestedQty;

      const existingIndex = state.items.findIndex(
        (i) => i.productId === incoming.productId,
      );

      if (existingIndex >= 0) {
        const existing = state.items[existingIndex];
        // Used items are one-of-one; second add no-ops.
        if (existing.condition === "used") {
          return state;
        }
        const nextQty = Math.min(
          existing.qty + clampedQty,
          existing.stockAtAdd,
        );
        if (nextQty === existing.qty) return state;
        const items = state.items.slice();
        items[existingIndex] = { ...existing, qty: nextQty };
        return { ...state, items };
      }

      const item: CartItem = {
        ...incoming,
        qty: clampedQty,
        addedAt: Date.now(),
      };
      return { ...state, items: [...state.items, item] };
    }

    case "REMOVE":
      return {
        ...state,
        items: state.items.filter((i) => i.productId !== action.productId),
      };

    case "SET_QTY": {
      const items = state.items.map((i) => {
        if (i.productId !== action.productId) return i;
        // Used items are one-of-one; SET_QTY is a no-op for them.
        if (i.condition === "used") return i;
        const clamped = Math.max(1, Math.min(action.qty, i.stockAtAdd));
        return { ...i, qty: clamped };
      });
      return { ...state, items };
    }

    case "CLEAR":
      return { ...state, items: [] };

    default:
      return state;
  }
}

/**
 * Public addItem argument shape. Mirrors the ADD action payload so
 * consumers pass a plain object and the provider wraps it into the
 * action. qty is optional; defaults to 1 in the reducer.
 */
export type AddItemInput = Omit<CartItem, "qty" | "addedAt"> & {
  qty?: number;
};

type CartContextValue = {
  items: CartItem[];
  mounted: boolean;
  count: number;
  totalPence: number;
  addItem: (item: AddItemInput) => void;
  removeItem: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  // Transient marketing-consent opt-in captured on /cart and read on
  // /checkout. Deliberately NOT in the reducer and NOT persisted to
  // localStorage: a returning buyer must re-choose each session rather
  // than inherit a stale opt-in (GDPR: consent must be fresh + explicit).
  marketingConsent: boolean;
  setMarketingConsent: (value: boolean) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // Hydration: read localStorage on mount, dispatch HYDRATE. This is the
  // pattern that dodges React 19's SSR/CSR mismatch — both server and
  // first client render see items=[] mounted=false, then the effect
  // runs and dispatches the real state.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        dispatch({ type: "HYDRATE", items: [] });
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      // Defensive: accept only array shape, ignore everything else.
      if (Array.isArray(parsed)) {
        dispatch({ type: "HYDRATE", items: parsed as CartItem[] });
      } else {
        dispatch({ type: "HYDRATE", items: [] });
      }
    } catch {
      // localStorage might be disabled (private mode, quota, etc.).
      // Fall back to in-memory cart silently.
      dispatch({ type: "HYDRATE", items: [] });
    }
  }, []);

  // Persistence: write to localStorage on every state change after mount.
  // Pre-mount writes would clobber the not-yet-read stored cart.
  useEffect(() => {
    if (!state.mounted) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      // Quota exceeded or storage unavailable. Cart still works in-memory.
    }
  }, [state.items, state.mounted]);

  const addItem = useCallback((item: AddItemInput) => {
    dispatch({ type: "ADD", item });
  }, []);

  const removeItem = useCallback((productId: string) => {
    dispatch({ type: "REMOVE", productId });
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    dispatch({ type: "SET_QTY", productId, qty });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => setDrawerOpen((o) => !o), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      mounted: state.mounted,
      count: state.mounted ? cartItemCount(state.items) : 0,
      totalPence: state.mounted ? cartTotalPence(state.items) : 0,
      addItem,
      removeItem,
      setQty,
      clearCart,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
      toggleDrawer,
      marketingConsent,
      setMarketingConsent,
    }),
    [
      state.items,
      state.mounted,
      addItem,
      removeItem,
      setQty,
      clearCart,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
      toggleDrawer,
      marketingConsent,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return ctx;
}
