"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { CartDrawer } from "@/components/cart/CartDrawer";

type CartDrawerContextValue = {
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
};

const CartDrawerContext = createContext<CartDrawerContextValue | null>(null);

/**
 * Owns the cart drawer's open state, so the navbar icon and the add-to-cart
 * button can both reach it without either knowing about the other. Mounted once
 * in the root layout, which also means the drawer survives navigation.
 */
export function CartDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isCartOpen, setIsCartOpen] = useState(false);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const toggleCart = useCallback(() => setIsCartOpen((open) => !open), []);

  const value = useMemo(
    () => ({ isCartOpen, openCart, closeCart, toggleCart }),
    [isCartOpen, openCart, closeCart, toggleCart],
  );

  return (
    <CartDrawerContext.Provider value={value}>
      {children}
      <CartDrawer />
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