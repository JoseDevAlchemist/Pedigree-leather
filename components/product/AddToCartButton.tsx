"use client";

import { Check } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { useCartStore } from "@/lib/store/cart";
import type { CartItem } from "@/lib/types";

type AddToCartButtonProps = {
  /** The line to add. Assembled by the detail page, which owns the colour and quantity. */
  item: CartItem;
  /** True when the product is sold out. Changes the label as well as the state. */
  soldOut?: boolean;
  className?: string;
};

/** How long the confirmation holds before the label returns. */
const CONFIRM_MS = 1500;

export function AddToCartButton({
  item,
  soldOut = false,
  className = "",
}: AddToCartButtonProps) {
  const reduceMotion = useReducedMotion();
  const addItem = useCartStore((state) => state.addItem);

  const [isConfirmed, setIsConfirmed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Clear the timer on unmount, so adding and then navigating away does not call
     setState on a component that is gone. */
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleClick = () => {
    if (soldOut) return;

    addItem(item);
    setIsConfirmed(true);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsConfirmed(false), CONFIRM_MS);
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={soldOut}
      /* Press feedback carries most of the weight here: nothing on this page
         changes when the item is added, so the button has to acknowledge it. */
      whileTap={soldOut || reduceMotion ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", duration: 0.25, bounce: 0 }}
      className={`relative flex h-12 w-full cursor-pointer items-center justify-center rounded-full px-6 text-sm font-semibold tracking-wide transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-background md:w-auto md:min-w-52 ${soldOut ? "bg-muted/50" : "bg-primary text-background hover:bg-primary-deep"} ${className}`}
    >
      {/* The resting label always occupies the button, so the confirmation can
          overlay it without the button resizing. */}
      <span className="flex items-center" aria-hidden={isConfirmed}>
        {soldOut ? "Sold out" : "Add to Cart"}
      </span>

      <AnimatePresence initial={false}>
        {isConfirmed ? (
          <motion.span
            key="added"
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={
              reduceMotion
                ? { opacity: 0, transition: { duration: 0 } }
                : { opacity: 0, y: -6 }
            }
            transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center gap-2 text-accent-ink"
          >
            <Check size={16} strokeWidth={2.5} aria-hidden="true" />
            Added
          </motion.span>
        ) : null}
      </AnimatePresence>

      {/* The visible labels are swapped under aria-hidden, so the confirmation
          is announced here instead. */}
      <span className="sr-only" role="status" aria-live="polite">
        {isConfirmed ? `${item.name} in ${item.colorName} added to cart` : ""}
      </span>
    </motion.button>
  );
}