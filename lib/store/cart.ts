"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { CartItem } from "@/lib/types";

/**
 * The cart.
 *
 * Identity is `productId` + `colorId`: one bag in cognac and the same bag in
 * black are two lines, because they are two different objects that will ship
 * separately.
 *
 * Persisted to localStorage, so the cart survives a reload and a closed tab.
 * Everything a line needs is denormalised into the item itself, so rehydrating
 * never has to wait on a fetch — the drawer can render before the network does.
 */

/** Ceiling per line. Matches the stepper on the detail page and in the drawer. */
export const MAX_QUANTITY_PER_ITEM = 10;

const CART_STORAGE_KEY = "pedigree-cart";

export function cartLineKey(productId: string, colorId: string): string {
  return `${productId}:${colorId}`;
}

export interface CartStore {
  items: CartItem[];

  /** Adds a line, or tops up the quantity if that product+colour is already in. */
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, colorId: string) => void;
  /** Setting a quantity of 0 or less removes the line. Quantity is capped at `MAX_QUANTITY_PER_ITEM`. */
  updateQuantity: (productId: string, colorId: string, quantity: number) => void;
  clearCart: () => void;

  /* Derived. Defined once at store creation so their identity is stable across
     renders — safe to read inside an effect without re-subscribing. */
  totalItems: () => number;
  subtotal: () => number;
}

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(MAX_QUANTITY_PER_ITEM, Math.max(1, Math.round(quantity)));
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) =>
        set((state) => {
          const incoming = clampQuantity(item.quantity);
          const match = state.items.findIndex(
            (line) =>
              line.productId === item.productId && line.colorId === item.colorId,
          );

          if (match === -1) {
            return { items: [...state.items, { ...item, quantity: incoming }] };
          }

          const items = [...state.items];
          items[match] = {
            ...items[match],
            // Refresh the denormalised copy so a later price or name change shows up.
            ...item,
            quantity: clampQuantity(items[match].quantity + incoming),
          };
          return { items };
        }),

      removeItem: (productId, colorId) =>
        set((state) => ({
          items: state.items.filter(
            (line) => !(line.productId === productId && line.colorId === colorId),
          ),
        })),

      updateQuantity: (productId, colorId, quantity) =>
        set((state) => {
          const match = state.items.find(
            (line) => line.productId === productId && line.colorId === colorId,
          );
          if (!match) return state;

          if (quantity < 1) {
            return {
              items: state.items.filter(
                (line) =>
                  !(line.productId === productId && line.colorId === colorId),
              ),
            };
          }

          return {
            items: state.items.map((line) =>
              line === match ? { ...line, quantity: clampQuantity(quantity) } : line,
            ),
          };
        }),

      clearCart: () => set({ items: [] }),

      totalItems: () =>
        get().items.reduce((sum, line) => sum + line.quantity, 0),

      subtotal: () =>
        get().items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    }),
    {
      name: CART_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      /* Only `items` is written to storage. Actions are functions and would be
         dropped by JSON anyway; on rehydrate zustand merges the stored `items`
         over the initial state, so the actions come back from the creator. */
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

/* ---------------------------------------------------------------------------
   Convenience hooks. Components read `items` and compute, rather than calling
   `totalItems()` in a selector: a selector that calls a function reading the
   store never re-runs, because the function reference never changes.
   --------------------------------------------------------------------------- */

/** Number of units in the cart. Safe to watch in an effect — this is a value. */
export function useCartCount(): number {
  const items = useCartStore((state) => state.items);
  return items.reduce((sum, line) => sum + line.quantity, 0);
}

/** Cart total in KES, as a number. Format with `formatPrice` at the edge. */
export function useCartSubtotal(): number {
  const items = useCartStore((state) => state.items);
  return items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
}