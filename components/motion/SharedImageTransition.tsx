"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * The card → detail transition.
 *
 * `layoutId` cannot carry this across an App Router route change. When you
 * navigate, React unmounts the grid and mounts the detail page in the same
 * commit: the card's projection node is deregistered in the mutation phase
 * (`unmount()` → `NodeStack.remove`), so by the time the detail page's node
 * registers in the layout phase there is no previous node left in the stack to
 * inherit a snapshot from. The mechanism is right, but it has nothing to morph
 * *from*.
 *
 * So the card measures itself at click time and hands the rect over. The detail
 * page measures itself on mount and animates the difference: a FLIP, but across
 * two React trees rather than two commits.
 *
 * Capturing before the navigation starts also means the handoff survives an
 * async server render in between.
 *
 * ---------------------------------------------------------------------------
 * WHY NOTHING HERE USES `layoutId` ANY MORE
 * ---------------------------------------------------------------------------
 * Session 3 removed it, and this is the note so it does not come back. The image
 * wrappers on the card and the detail page used to both carry
 * `layoutId={`card-image-${product.id}`}`, on the theory that it was "the right
 * mechanism" and might start working. It cannot work (see above), and it actively
 * *broke* the home page.
 *
 * Motion treats a `layoutId` as a claim of uniqueness. Two elements with the same
 * id inside one projection tree are the same shared layout element, so Motion
 * hides every instance except one — the ones it does not pick are painted at
 * `opacity: 0`. On `/bags` no product appears twice, so nothing showed. On `/`
 * the featured rail, the new-arrivals grid and the bags preview all render the
 * same products, and eight of the fourteen cards came out as blank cream blocks
 * with correct computed styles. The colour was not missing from the DOM; it was
 * missing from the paint.
 *
 * A product showing up in two sections is not a mistake to be engineered around
 * — it is how the home page is meant to work. So the morph stays hand-rolled and
 * unique: `capture()` is keyed by product id, and the rect it stores comes from
 * the specific card the shopper actually clicked. Two cards for the same bag
 * morph to the same page correctly, each from where it was on screen.
 */

/** The image well's position on screen, in viewport pixels, at click time. */
type SharedImageRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type SharedImageSnapshot = SharedImageRect & {
  /** Which colour the shopper had chosen on the card, so the detail page opens on it. */
  colorIndex: number;
};

type SharedImageContextValue = {
  /** Record a card's image well just before navigating away from it. */
  capture: (productId: string, element: HTMLElement, colorIndex: number) => void;
  /**
   * Read a snapshot. Pure, so the detail page can call it while rendering to
   * pick its starting colour.
   */
  peek: (productId: string) => SharedImageSnapshot | null;
  /** Drop a snapshot once it has been used, so a stale rect is never replayed. */
  release: (productId: string) => void;
};

const SharedImageContext = createContext<SharedImageContextValue | null>(null);

/* Fail soft outside the provider (a test, a story): the page still works, it
   just arrives without a morph. */
const FALLBACK: SharedImageContextValue = {
  capture: () => {},
  peek: () => null,
  release: () => {},
};

export function SharedImageTransitionProvider({ children }: { children: React.ReactNode }) {
  /* Keyed by product id, so a card clicked ten minutes ago cannot be mistaken
     for the one just clicked. */
  const [snapshots, setSnapshots] = useState<Record<string, SharedImageSnapshot>>({});

  const capture = useCallback(
    (productId: string, element: HTMLElement, colorIndex: number) => {
      const { top, left, width, height } = element.getBoundingClientRect();
      /* A zero-sized rect means the card was never laid out (mid-scroll-in, or a
         hidden grid). There is nothing to morph from, so record nothing. */
      if (width === 0 || height === 0) return;

      setSnapshots((current) => ({
        ...current,
        [productId]: { top, left, width, height, colorIndex },
      }));
    },
    [],
  );

  const peek = useCallback(
    (productId: string) => snapshots[productId] ?? null,
    [snapshots],
  );

  const release = useCallback((productId: string) => {
    setSnapshots((current) => {
      if (!(productId in current)) return current;
      const next = { ...current };
      delete next[productId];
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ capture, peek, release }),
    [capture, peek, release],
  );

  return (
    /* No `LayoutGroup` here any more: the only thing it was scoping was the
       product images' `layoutId`s, which are gone. The navbar's sliding stitch
       is the app's one remaining shared layout id, and there is only ever one
       of it on screen. */
    <SharedImageContext.Provider value={value}>{children}</SharedImageContext.Provider>
  );
}

export function useSharedImageTransition(): SharedImageContextValue {
  return useContext(SharedImageContext) ?? FALLBACK;
}