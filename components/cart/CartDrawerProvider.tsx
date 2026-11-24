"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useCartStore } from "@/lib/store/cart";

const CartDrawer = dynamic(() => import("@/components/cart/CartDrawer").then((mod) => mod.CartDrawer), { ssr: false });

let hydration: Promise<void> | undefined;
function hydrateCart() {
  hydration ??= Promise.resolve().then(() => useCartStore.persist?.rehydrate()).then(
    () => undefined,
    () => undefined,
  );
  return hydration;
}

type CartDrawerContextValue = {
  isCartOpen: boolean;
  isCartHydrated: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
};

const CartDrawerContext = createContext<CartDrawerContextValue | null>(null);

/**
 * Owns the cart drawer's open state, so the navbar icon and the add-to-cart
 * button can both reach it without either knowing about the other. Mounted once
 * in the shop layout, which also means the drawer survives navigation.
 */
export function CartDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [isCartHydrated, setIsCartHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    void hydrateCart().then(() => {
      if (mounted) setIsCartHydrated(true);
    });
    return () => { mounted = false; };
  }, []);

  const openCart = useCallback(() => {
    setHasOpened(true);
    setIsCartOpen(true);
  }, []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const toggleCart = useCallback(() => {
    setHasOpened(true);
    setIsCartOpen((open) => !open);
  }, []);

  const value = useMemo(
    () => ({ isCartOpen, isCartHydrated, openCart, closeCart, toggleCart }),
    [isCartOpen, isCartHydrated, openCart, closeCart, toggleCart],
  );

  return (
    <CartDrawerContext.Provider value={value}>
      {children}
      {hasOpened && <CartDrawer />}
    </CartDrawerContext.Provider>
  );
}

export function useCartDrawer(): CartDrawerContextValue {
  const context = useContext(CartDrawerContext);
  if (!context) {
    throw new Error("useCartDrawer must be used inside a CartDrawerProvider.");
  }
  return context;
}