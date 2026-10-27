"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Menu, MessageCircle, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { NAV_ITEMS } from "@/lib/navigation";
import type { Category } from "@/lib/types";

import { CartIcon } from "@/components/cart/CartIcon";
import { BrandMark, Wordmark } from "@/components/layout/Brand";

/** Gold stitch sliding between links is the one piece of motion in the bar. */
const STITCH_SPRING = { type: "spring", duration: 0.35, bounce: 0 } as const;

type NavbarProps = {
  /**
   * Server-fetched active categories. When empty or absent the navbar falls back
   * to the static items in `lib/navigation.ts` — the shell never crashes because
   * the category fetch failed.
   */
  categories?: readonly Category[];
};

function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function Navbar({ categories }: NavbarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [isScrolled, setIsScrolled] = useState(false);

  /* Search is an inline form on desktop and a full-screen overlay on mobile.
     One open state drives both; only the matching layout renders at each width. */
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const desktopSearchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const hadSearchOpen = useRef(false);

  /* The drawer is open for the route it was opened on. Deriving it from the
     pathname (instead of resetting state in an effect) closes it on every
     navigation, including browser back/forward. */
  const [openedAtPath, setOpenedAtPath] = useState<string | null>(null);
  const isOpen = openedAtPath === pathname;

  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* Desktop dropdown state: which category slug is expanded. */
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  /* Build the link list: server-fetched categories when they exist, plus the
     static items (Home, Contact). The old hardcoded Bags/Shoes links are only a
     fallback for a failed/empty category fetch; once the database has roots, the
     categories own those slots and the static duplicates disappear. */
  const categoryLinks = categories?.filter((c) => !c.parentId) ?? [];
  const usingCategories = categoryLinks.length > 0;
  const staticLinks = NAV_ITEMS.filter(
    (item) => !usingCategories || (item.href !== "/bags" && item.href !== "/shoes"),
  );

  type NavEntry = {
    href: string;
    label: string;
    key: string;
    children: { id: string; name: string; slug: string }[];
  };

  const links: NavEntry[] = [
    ...categoryLinks.map((cat) => ({
      href: `/category/${cat.slug}`,
      label: cat.name,
      key: `cat-${cat.id}`,
      children:
        categories?.filter((c) => c.parentId === cat.id).map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
        })) ?? [],
    })),
    ...staticLinks.map((item) => ({
      href: item.href,
      label: item.label,
      key: `static-${item.href}`,
      children: [],
    })),
  ];

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

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchValue("");
  }, []);

  const openSearch = () => {
    setSearchValue("");
    setIsSearchOpen(true);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = searchValue.trim();
    if (!term) return;

    setIsSearchOpen(false);
    setSearchValue("");
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  /* Put the caret in the input that is visible at the current breakpoint. The
     desktop form and the mobile overlay are both mounted; only one is shown. */
  useEffect(() => {
    if (!isSearchOpen) return;

    const frame = window.requestAnimationFrame(() => {
      const desktop = window.matchMedia("(min-width: 768px)").matches;
      (desktop ? desktopSearchRef.current : mobileSearchRef.current)?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isSearchOpen]);

  /* The mobile overlay is modal: lock the page behind it and trap focus. The
     desktop form is inline, so neither applies there. Escape closes both. */
  useEffect(() => {
    if (!isSearchOpen) return;

    const desktop = window.matchMedia("(min-width: 768px)");
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;

    const syncScrollLock = () => {
      if (desktop.matches) {
        body.style.overflow = previousOverflow;
        body.style.paddingRight = previousPaddingRight;
        return;
      }

      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      body.style.overflow = "hidden";
      if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    };

    syncScrollLock();
    desktop.addEventListener("change", syncScrollLock);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSearch();
        return;
      }

      if (event.key !== "Tab" || desktop.matches) return;

      const focusables = searchPanelRef.current?.querySelectorAll<HTMLElement>(
        'input, button:not([disabled])',
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
      desktop.removeEventListener("change", syncScrollLock);
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [closeSearch, isSearchOpen]);

  /* Navigate after the shopper stops typing for half a second. Enter submits
     immediately; closing the form cancels the pending timer via the cleanup. */
  useEffect(() => {
    if (!isSearchOpen) return;

    const term = searchValue.trim();
    if (!term) return;

    const timer = window.setTimeout(() => {
      setIsSearchOpen(false);
      setSearchValue("");
      router.push(`/search?q=${encodeURIComponent(term)}`);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [isSearchOpen, router, searchValue]);

  /* Closing returns focus to the trigger that opened search. */
  useEffect(() => {
    if (hadSearchOpen.current && !isSearchOpen) {
      searchToggleRef.current?.focus({ preventScroll: true });
    }
    hadSearchOpen.current = isSearchOpen;
  }, [isSearchOpen]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-4 focus:z-60 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary"
      >
        Skip to content
      </a>

      <header
        className={`sticky top-0 z-50 border-b border-black/10 bg-primary-dark transition-shadow duration-200 ease-out ${
          isScrolled ? "shadow-bar" : "shadow-none"
        }`}
      >
        <div
          className={`mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 transition-[height] duration-200 ease-out sm:gap-4 md:px-8 ${
            isScrolled ? "h-[3.75rem] md:h-[4.75rem]" : "h-16 md:h-20"
          }`}
        >
          <Link
            href="/"
            className="-m-1 flex items-center gap-2 rounded-full p-1 transition-transform duration-150 ease-out active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:gap-3"
          >
            <BrandMark priority />
            <Wordmark className="text-lg sm:text-xl md:text-2xl" />
          </Link>

          {/* Desktop navigation */}
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {links.map((item) => {
                const active = isActive(item.href, pathname);
                const hasChildren = item.children && item.children.length > 0;
                const isOpenDropdown = openDropdown === item.key;

                if (hasChildren) {
                  return (
                    <li
                      key={item.key}
                      className="relative group"
                      onMouseEnter={() => setOpenDropdown(item.key)}
                      onMouseLeave={() => setOpenDropdown(null)}
                      onFocus={() => setOpenDropdown(item.key)}
                      onBlur={(event) => {
                        const next = event.relatedTarget;
                        if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
                          setOpenDropdown(null);
                        }
                      }}
                    >
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        aria-expanded={isOpenDropdown}
                        aria-haspopup="true"
                        className={`relative block px-3 py-2 text-sm font-medium tracking-wide transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
                          active
                            ? "text-background"
                            : "text-background/75 hover:text-accent-ink"
                        }`}
                      >
                        {item.label}
                      </Link>
                      {isOpenDropdown && (
                        <div className="absolute top-full left-0 z-50 pt-2">
                          <div className="w-48 rounded-xl border border-border bg-card py-2 shadow-panel">
                            <ul>
                              {item.children.map((child) => {
                                const childActive = isActive(`/category/${child.slug}`, pathname);
                                return (
                                  <li key={child.id}>
                                    <Link
                                      href={`/category/${child.slug}`}
                                      aria-current={childActive ? "page" : undefined}
                                      className={`block px-4 py-2 text-sm transition-colors duration-150 ease-out hover:bg-background/5 ${childActive ? "text-accent" : "text-background/75"}`}
                                    >
                                      {child.name}
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                }

                return (
                  <li key={item.key}>
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
                      {active && !hasChildren ? (
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

          {/* Actions. Cart, search and the menu trigger fit on a phone; the
              contact shortcut joins them from `sm` up. Contact is still in the
              drawer, so nothing is lost on the smallest screens. */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            {/* Search: an expanding field on desktop, a full-screen overlay on
                mobile. The trigger disappears while the field is open so the
                two never compete for the same space. */}
            {isSearchOpen ? (
              <form
                onSubmit={submitSearch}
                role="search"
                className="hidden items-center md:flex"
              >
                <div className="flex h-9 items-center gap-2 rounded-full border border-background/25 bg-background/10 pl-3 transition-colors duration-150 ease-out focus-within:border-accent focus-within:bg-background/15">
                  <Search
                    size={16}
                    strokeWidth={2}
                    className="shrink-0 text-background/70"
                    aria-hidden="true"
                  />
                  <input
                    ref={desktopSearchRef}
                    type="search"
                    name="q"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="Search products, colours…"
                    aria-label="Search products"
                    autoComplete="off"
                    className="w-40 bg-transparent text-sm text-background placeholder:text-background/50 focus:outline-none lg:w-56"
                  />
                  <button
                    type="button"
                    onClick={closeSearch}
                    aria-label="Close search"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-background/60 transition-colors duration-150 ease-out hover:bg-background/10 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <X size={15} strokeWidth={2} aria-hidden="true" />
                  </button>
                </div>
              </form>
            ) : (
              <button
                ref={searchToggleRef}
                type="button"
                onClick={openSearch}
                aria-expanded={isSearchOpen}
                aria-label="Search"
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-background transition-colors duration-150 ease-out hover:bg-background/10 hover:text-accent active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Search size={22} strokeWidth={2} aria-hidden="true" />
              </button>
            )}

            <CartIcon />

            <Link
              href="/contact"
              aria-label="Contact us"
              className="hidden size-11 shrink-0 items-center justify-center rounded-full text-background transition-colors duration-150 ease-out hover:bg-background/10 hover:text-accent active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:flex"
            >
              <MessageCircle size={22} strokeWidth={2} aria-hidden="true" />
            </Link>

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

      {/* Mobile search overlay */}
      <AnimatePresence>
        {isSearchOpen ? (
          <motion.div
            key="mobile-search"
            ref={searchPanelRef}
            id="mobile-search"
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className="fixed inset-0 z-[60] flex flex-col bg-background md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.18, ease: "easeOut" }}
          >
            <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
              <Search
                size={20}
                strokeWidth={2}
                className="shrink-0 text-muted"
                aria-hidden="true"
              />
              <form onSubmit={submitSearch} role="search" className="min-w-0 flex-1">
                <input
                  ref={mobileSearchRef}
                  type="search"
                  name="q"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search products, colours, categories…"
                  aria-label="Search products"
                  autoComplete="off"
                  className="h-12 w-full bg-transparent text-base text-foreground placeholder:text-muted focus:outline-none"
                />
              </form>
              <button
                type="button"
                onClick={closeSearch}
                aria-label="Close search"
                className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors duration-150 ease-out hover:bg-foreground/5 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <X size={22} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <p className="px-5 py-4 text-sm text-muted">
              Search by product, category, or colour. Press Enter to see results.
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

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
                  {links.map((item) => {
                    const active = isActive(item.href, pathname);
                    const hasChildren = item.children && item.children.length > 0;

                    if (hasChildren) {
                      return (
                        <li key={item.key} className="relative">
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
                          <ul className="mt-1 pl-4 border-l border-background/20">
                            {item.children.map((child) => {
                              const childActive = isActive(`/category/${child.slug}`, pathname);
                              return (
                                <li key={child.id}>
                                  <Link
                                    href={`/category/${child.slug}`}
                                    onClick={() => setOpenedAtPath(null)}
                                    aria-current={childActive ? "page" : undefined}
                                    className={`block px-3 py-2 text-sm transition-colors duration-150 ease-out hover:bg-background/5 ${
                                      childActive ? "text-accent" : "text-background/70"
                                    }`}
                                  >
                                    {child.name}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      );
                    }

                    return (
                      <li key={item.key}>
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
