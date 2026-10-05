"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * SSR-safe `window.matchMedia`.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`. The obvious way to
 * write this is to read the query inside an effect and store it, and that has two
 * problems: it renders `false` on the server *and* on the first client render,
 * so the value is wrong for a frame; and setting state synchronously inside an
 * effect is a cascading render the React lint rules rightly reject.
 *
 * The store version gets both right. `getServerSnapshot` supplies `false` during
 * SSR and hydration, and React re-reads the snapshot immediately after hydration
 * commits, so the real value lands without a wrong frame in between. It also
 * means no listener is attached until after mount, which is what
 * `matchMedia` needs anyway.
 *
 * Note that this returns `false` until hydration completes. Every caller must
 * treat `false` as "not yet known" rather than as "no" — that is fine here
 * because this only ever gates *behaviour*, never layout. Layout belongs in CSS
 * media queries, which the browser resolves before the first paint.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onStoreChange);
      return () => list.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  /* The server has no viewport. Anything but `false` here would make the server
     HTML and the first client render disagree. */
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * A pointer with real hover — a mouse or a trackpad.
 *
 * Not the same question as `min-width: 768px`. A narrow desktop window has
 * hover; a touch laptop has hover *and* a touchscreen; a phone has neither.
 * Anything driven by "the cursor is over this" should ask this question rather
 * than the viewport width.
 */
export function useHasHover(): boolean {
  return useMediaQuery("(hover: hover) and (pointer: fine)");
}