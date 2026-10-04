"use client";

import { AnimatePresence, motion, useAnimation, useReducedMotion } from "motion/react";
import { ShoppingBag } from "lucide-react";
import { useEffect, useRef } from "react";

import { useCartCount } from "@/lib/store/cart";

import { useCartDrawer } from "@/components/cart/CartDrawerProvider";

/**
 * The navbar's cart button.
 *
 * The badge pops when the count goes up. It does not pop on the way down, and it
 * does not pop on the first render after a reload — that jump from 0 is
 * rehydration catching up, not an addition, and animating it would make every
 * returning visitor think something had just been added.
 */
export function CartIcon() {
  const reduceMotion = useReducedMotion();
  const { openCart, isCartOpen } = useCartDrawer();
  const count = useCartCount();

  const badgeControls = useAnimation();
  const previousCount = useRef(count);
  const hasMounted = useRef(false);

  useEffect(() => {
    /* The first effect run happens after rehydration may already have run, so it
       is not a change — just the number arriving. */
    if (!hasMounted.current) {
      hasMounted.current = true;
      previousCount.current = count;
      return;
    }

    if (count > previousCount.current && !reduceMotion) {
      badgeControls.start({
        scale: [1, 1.3, 1],
        transition: { duration: 0.36, ease: "easeOut" },
      });
    }

    previousCount.current = count;
  }, [badgeControls, count, reduceMotion]);

  return (
    <button
      type="button"
      onClick={openCart}
      aria-expanded={isCartOpen}
      aria-label={count === 0 ? "Cart, empty" : `Cart, ${count} ${count === 1 ? "item" : "items"}`}
      className="relative -mr-1 flex size-11 cursor-pointer items-center justify-center rounded-full text-background transition-colors duration-150 ease-out hover:bg-background/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <ShoppingBag size={22} strokeWidth={2} aria-hidden="true" />

      <AnimatePresence>
        {count > 0 ? (
          <motion.span
            key="cart-badge"
            initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { scale: 0, opacity: 0 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            style={{ originX: 0.9, originY: 0.9 }}
            className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[0.6875rem] leading-[1.25rem] font-bold tabular-nums text-primary"
          >
            {/* Only the digits scale, not the pill, so the badge keeps its
                shape while the number gives it a kick. */}
            <motion.span animate={badgeControls} className="inline-block">
              {count}
            </motion.span>
          </motion.span>
        ) : null}
      </AnimatePresence>
    </button>
  );
}