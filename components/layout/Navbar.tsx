"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { NAV_ITEMS } from "@/lib/navigation";

import { CartIcon } from "@/components/cart/CartIcon";
import { BrandMark, Wordmark } from "@/components/layout/Brand";

/** Gold stitch sliding between links is the one piece of motion in the bar. */
const STITCH_SPRING = { type: "spring", duration: 0.35, bounce: 0 } as const;

export function Navbar() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const [isScrolled, setIsScrolled] = useState(false);

  /* The drawer is open for the route it was opened on. Deriving it from the
     pathname (instead of resetting state in an effect) closes it on every
     navigation, including browser back/forward. */
  const [openedAtPath, setOpenedAtPath] = useState<string | null>(null);
  const isOpen = openedAtPath === pathname;

  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) =>
    href === "/" ? pathname === href : pathname.startsWith(href);

  /* Bar picks up a shadow once the page has scrolled off the top. */
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Growing past md hides the drawer, so release the scroll lock. */
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpenedAtPath(null);
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  /* While the drawer is open: lock the page behind it, move focus into it,
     keep Tab inside it, and close on Escape. */
  useEffect(() => {
    if (!isOpen) return;

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
        setOpenedAtPath(null);
        toggleRef.current?.focus();
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
  }, [isOpen]);

  const closeDrawer = useCallback(() => {
    setOpenedAtPath(null);
    toggleRef.current?.focus();
  }, []);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-4 focus:z-60 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary"
      >
        Skip to content
      </a>

      <header
        className={`sticky top-0 z-50 bg-primary transition-shadow duration-200 ease-out ${
          isScrolled ? "shadow-bar" : "shadow-none"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:h-20 md:px-8">
          <Link
            href="/"
            className="-m-1 flex items-center gap-3 rounded-full p-1 transition-transform duration-150 ease-out active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            <BrandMark priority />
            <Wordmark className="text-xl md:text-2xl" />
          </Link>

          {/* Desktop navigation */}
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = !item.comingSoon && isActive(item.href);

                if (item.comingSoon) {
                  return (
                    <li key={item.href}>
                      <span
                        aria-disabled="true"
                        title="Shoes are coming soon"
                        className="flex cursor-not-allowed items-center gap-2 px-3 py-2 text-sm font-medium text-background/45"
                      >
                        {item.label}
                        <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[0.6875rem] leading-none text-accent-ink">
                          Soon
                        </span>
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`relative block px-3 py-2 text-sm font-medium tracking-wide transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
                        active
                          ? "text-background"
                          : "text-background/75 hover:text-accent-ink"
                      }`}
                    >
                      {item.label}
                      {active ? (
                        <motion.span
                          layoutId="nav-stitch"
                          aria-hidden="true"
                          className="stitch absolute inset-x-3 -bottom-0.5 h-px text-accent"
                          transition={STITCH_SPRING}
                        />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Actions. The cart sits above the menu trigger on a phone, so it is
              reachable without opening the drawer first. */}
          <div className="flex items-center gap-1">
            <CartIcon />

            {/* Mobile trigger */}
            <button
              ref={toggleRef}
              type="button"
              onClick={() => setOpenedAtPath(pathname)}
              aria-expanded={isOpen}
              aria-controls="mobile-menu"
              aria-label="Open menu"
              className="-mr-1 flex size-11 items-center justify-center rounded-full text-background transition-colors duration-150 ease-out hover:bg-background/10 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:hidden"
            >
              <Menu size={24} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isOpen ? (
          <div key="mobile-menu" className="fixed inset-0 z-50 md:hidden">
            <motion.div
              aria-hidden="true"
              onClick={closeDrawer}
              className="absolute inset-0 bg-charcoal/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            />

            <motion.div
              ref={panelRef}
              id="mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col bg-primary shadow-panel"
              initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
              animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
              exit={
                reduceMotion
                  ? { opacity: 0, transition: { duration: 0.15 } }
                  : { x: "100%", transition: { duration: 0.22, ease: "easeOut" } }
              }
              transition={{ type: "spring", duration: 0.4, bounce: 0 }}
            >
              <div className="flex h-16 shrink-0 items-center justify-between gap-3 px-5">
                <span className="flex items-center gap-3">
                  <BrandMark />
                  <Wordmark className="text-lg" />
                </span>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={closeDrawer}
                  aria-label="Close menu"
                  className="-mr-2 flex size-11 items-center justify-center rounded-full text-background transition-colors duration-150 ease-out hover:bg-background/10 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <X size={22} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>

              <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-3 py-2">
                <ul className="flex flex-col gap-1">
                  {NAV_ITEMS.map((item) => {
                    const active = !item.comingSoon && isActive(item.href);

                    if (item.comingSoon) {
                      return (
                        <li key={item.href}>
                          <span
                            aria-disabled="true"
                            className="flex min-h-14 cursor-not-allowed items-center justify-between gap-3 px-3 text-lg text-background/45"
                          >
                            {item.label}
                            <span className="rounded-full border border-accent/40 px-2.5 py-1 text-xs leading-none text-accent-ink">
                              Soon
                            </span>
                          </span>
                        </li>
                      );
                    }

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setOpenedAtPath(null)}
                          aria-current={active ? "page" : undefined}
                          className={`relative flex min-h-14 items-center px-3 text-lg transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                            active ? "text-background" : "text-background/80"
                          }`}
                        >
                          {item.label}
                          {active ? (
                            <span
                              aria-hidden="true"
                              className="stitch absolute right-3 bottom-3 left-3 h-px text-accent"
                            />
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <p className="shrink-0 px-6 py-6 text-sm text-background/50">
                Luxury bags, made in Nairobi.
              </p>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
