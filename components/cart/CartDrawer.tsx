"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { formatPrice } from "@/lib/format";
import { MAX_QUANTITY_PER_ITEM, useCartStore, useCartCount, useCartSubtotal } from "@/lib/store/cart";

import { useCartDrawer } from "@/components/cart/CartDrawerProvider";
import { QuantityStepper } from "@/components/ui/QuantityStepper";

/* Exit is faster than enter: a drawer that lingers on the way out feels stuck. */
const ENTER_SPRING = { type: "spring", duration: 0.42, bounce: 0 } as const;
const EXIT = { duration: 0.22, ease: "easeOut" } as const;

export function CartDrawer() {
  const reduceMotion = useReducedMotion();
  const { isCartOpen, closeCart } = useCartDrawer();

  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);

  const totalItems = useCartCount();
  const subtotal = useCartSubtotal();

  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  /* While the drawer is open: lock the page behind it, move focus in, keep Tab
     inside it, and close on Escape. Without the scroll lock the page behind
     scrolls under the drawer on a trackpad. */
  useEffect(() => {
    if (!isCartOpen) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    // Reserve the scrollbar's width so locking it does not shift the page.
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCart();
        return;
      }

      if (event.key !== "Tab") return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [closeCart, isCartOpen]);

  return (
    <AnimatePresence>
      {isCartOpen ? (
        <div key="cart-drawer" className="fixed inset-0 z-60">
          <motion.div
            aria-hidden="true"
            onClick={closeCart}
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Cart"
            /* Most of the width on a phone; a fixed panel on a desktop, where
               the grid behind it stays partly readable. */
            className="absolute inset-y-0 right-0 flex w-[min(24rem,100vw)] flex-col bg-background shadow-panel sm:w-[26rem] lg:w-[27.5rem]"
            initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={
              reduceMotion
                ? { opacity: 0, transition: { duration: 0 } }
                : { x: "100%", transition: EXIT }
            }
            transition={ENTER_SPRING}
          >
            <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-5">
              <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
                Cart{" "}
                <span className="font-sans text-sm font-medium tabular-nums text-muted">
                  ({totalItems} {totalItems === 1 ? "item" : "items"})
                </span>
              </h2>

              <button
                ref={closeRef}
                type="button"
                onClick={closeCart}
                aria-label="Close cart"
                className="-mr-2 flex size-11 cursor-pointer items-center justify-center rounded-full text-muted transition-colors duration-150 ease-out hover:bg-primary/8 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <X size={22} strokeWidth={2} aria-hidden="true" />
              </button>
            </header>

            {items.length === 0 ? (
              <EmptyCart onClose={closeCart} />
            ) : (
              <>
                {/* `layout` so a removal animates the remaining lines up into the
                    gap instead of snapping. */}
                <ul className="flex-1 divide-y divide-border overflow-y-auto overscroll-contain px-5">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <motion.li
                        key={`${item.productId}:${item.colorId}`}
                        layout
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={
                          reduceMotion
                            ? { opacity: 0, transition: { duration: 0 } }
                            : { opacity: 0, transition: { duration: 0.15 } }
                        }
                        transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
                        className="flex gap-4 py-4"
                      >
                        <CartLineThumbnail image={item.image} hex={item.colorHex} />

                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {item.name}
                              </p>
                              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                                <span
                                  aria-hidden="true"
                                  className="size-2.5 shrink-0 rounded-full"
                                  style={{ backgroundColor: item.colorHex, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.12)" }}
                                />
                                {item.colorName}
                              </p>
                            </div>

                            <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                              {formatPrice(item.unitPrice * item.quantity)}
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <QuantityStepper
                              size="sm"
                              value={item.quantity}
                              max={MAX_QUANTITY_PER_ITEM}
                              onChange={(next) =>
                                updateQuantity(item.productId, item.colorId, next)
                              }
                              label={`Quantity for ${item.name} in ${item.colorName}`}
                            />

                            <button
                              type="button"
                              onClick={() => removeItem(item.productId, item.colorId)}
                              className="cursor-pointer rounded-full px-2 py-1.5 text-xs font-medium text-muted underline underline-offset-4 transition-colors duration-150 ease-out hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>

                <footer className="shrink-0 border-t border-border px-5 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-muted">Subtotal</span>
                    <span className="font-serif text-2xl font-semibold tabular-nums text-foreground">
                      {formatPrice(subtotal)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Delivery is worked out at checkout, from your area.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      console.log("[checkout] not built yet", { items, subtotal })
                    }
                    className="mt-3 flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-primary text-sm font-semibold tracking-wide text-background transition-colors duration-200 ease-out hover:bg-primary-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:bg-muted/50 disabled:text-background"
                    disabled={items.length === 0}
                  >
                    Checkout
                  </button>
                  <p className="mt-2 text-center text-xs text-muted">
                    Checkout opens in the next build. For now this just logs the order.
                  </p>
                </footer>
              </>
            )}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function CartLineThumbnail({
  image,
  hex,
}: {
  image: string | null;
  hex: string;
}) {
  if (image) {
    return (
      /* A plain <img>: these are 64px thumbnails and every one of them would
         otherwise get its own optimized file plus a loader. Real photography
         will arrive on a CDN, which is the point at which this changes. */
      <img
        src={image}
        alt=""
        width={64}
        height={64}
        className="size-16 shrink-0 rounded-lg object-cover"
        style={{ boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.08)" }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="size-16 shrink-0 rounded-lg"
      style={{ backgroundColor: hex, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.08)" }}
    />
  );
}

/**
 * The empty cart.
 *
 * Three parts, and all three earn their place: an icon so the empty panel is
 * visibly a *cart* rather than an unfinished drawer, a sentence that suggests
 * what to do next rather than merely reporting that there is nothing, and one
 * prominent action. Two buttons here would be a false choice — there is exactly
 * one place to go.
 *
 * The icon is a soft circle in the card token rather than a bare glyph, because
 * the panel is a warm cream and a floating outline icon at this size reads as
 * loading, not as an empty basket.
 */
function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
      <span
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-full bg-border/40 text-primary"
      >
        <ShoppingBag className="size-7" strokeWidth={1.5} />
      </span>

      <div className="space-y-1.5">
        <p className="font-serif text-xl font-semibold tracking-tight text-foreground">
          Your cart is empty
        </p>
        <p className="max-w-[26ch] text-pretty leading-relaxed text-muted">
          Nothing in yet. Have a look at the bags — the weekenders go quickly.
        </p>
      </div>

      <Link
        href="/bags"
        onClick={onClose}
        className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-background transition-colors duration-200 ease-out hover:bg-primary-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Browse bags
      </Link>
    </div>
  );
}