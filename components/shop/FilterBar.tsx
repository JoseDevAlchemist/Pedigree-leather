"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  buildProductFilterQuery,
  countActiveFilters,
  isPriceBandActive,
  PRICE_BANDS,
  SORT_OPTIONS,
  type CategoryColorOption,
  type ProductFilters,
  type ProductSort,
} from "@/lib/product-filters";

type FilterBarProps = {
  availableColors: readonly CategoryColorOption[];
  filters: ProductFilters;
};

type FilterControlsProps = {
  idPrefix: string;
  availableColors: readonly CategoryColorOption[];
  filters: ProductFilters;
  onChange: (next: ProductFilters) => void;
  onClear: () => void;
};

/**
 * The controls themselves, reused by the desktop sidebar and the mobile sheet.
 * `useId` keeps their label/input pairs unique when both copies are mounted.
 */
function FilterControls({
  idPrefix,
  availableColors,
  filters,
  onChange,
  onClear,
}: FilterControlsProps) {
  const sortId = `${idPrefix}-sort`;
  const colorsId = `${idPrefix}-colors`;
  const priceId = `${idPrefix}-price`;
  const activeCount = countActiveFilters(filters);

  const toggleColor = (value: string, checked: boolean) => {
    const next = checked
      ? [...filters.colors, value].sort()
      : filters.colors.filter((color) => color !== value);

    onChange({ ...filters, colors: next });
  };

  return (
    <div className="space-y-7">
      <div>
        <label
          htmlFor={sortId}
          className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted uppercase"
        >
          Sort by
        </label>
        <div className="relative mt-2">
          <select
            id={sortId}
            value={filters.sort}
            onChange={(event) =>
              onChange({
                ...filters,
                sort: event.target.value as ProductSort,
              })
            }
            className="min-h-11 w-full appearance-none rounded-xl border border-border bg-background py-2 pr-10 pl-3 text-sm font-medium text-foreground transition-colors duration-150 ease-out hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            strokeWidth={2}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
          />
        </div>
      </div>

      <fieldset aria-labelledby={colorsId}>
        <legend
          id={colorsId}
          className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted uppercase"
        >
          Colour
        </legend>

        {availableColors.length > 0 ? (
          <div className="mt-3 space-y-2.5">
            {availableColors.map((color, index) => {
              const checkboxId = `${colorsId}-${index}`;

              return (
                <label
                  key={color.value}
                  htmlFor={checkboxId}
                  className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-foreground transition-colors duration-150 ease-out hover:text-primary"
                >
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={filters.colors.includes(color.value)}
                    onChange={(event) =>
                      toggleColor(color.value, event.target.checked)
                    }
                    className="size-4 shrink-0 rounded border-border accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  />
                  <span
                    aria-hidden="true"
                    className="size-3.5 shrink-0 rounded-full border border-black/15 shadow-sm"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span>{color.label}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No colours available yet.</p>
        )}
      </fieldset>

      <fieldset aria-labelledby={priceId}>
        <legend
          id={priceId}
          className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted uppercase"
        >
          Price
        </legend>

        <div className="mt-3 flex flex-wrap gap-2">
          {PRICE_BANDS.map((band) => {
            const active = isPriceBandActive(filters, band);

            return (
              <button
                key={band.id}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange({
                    ...filters,
                    minPrice: active ? undefined : band.minPrice,
                    maxPrice: active ? undefined : band.maxPrice,
                  })
                }
                className={`inline-flex min-h-10 items-center rounded-full border px-3 text-xs font-medium transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  active
                    ? "border-primary bg-primary text-background"
                    : "border-border bg-background text-foreground hover:border-primary/40 hover:text-primary"
                }`}
              >
                {band.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {activeCount > 0 ? (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-10 items-center text-sm font-medium text-primary underline-offset-4 transition-colors duration-150 ease-out hover:text-primary-deep hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}

/**
 * Category filters.
 *
 * Desktop: a sticky card in the grid's left column.
 * Mobile: a trigger above the grid and a slide-up sheet with the same controls.
 *
 * The page passes the parsed filters from the server so the first paint matches
 * the URL. Local state keeps rapid checkbox clicks instant and is adopted from the
 * server when a new render arrives. Every change pushes a new URL; the category
 * page reads it and re-queries Supabase, so filtering stays server-side.
 */
export function FilterBar({ availableColors, filters }: FilterBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  /* Keep the controls instant while the server query is in flight. When a new
     server render arrives — including browser back/forward — the prop identity
     changes and we adopt it before painting. */
  const [localFilters, setLocalFilters] = useState(filters);
  const [serverFilters, setServerFilters] = useState(filters);
  if (serverFilters !== filters) {
    setServerFilters(filters);
    setLocalFilters(filters);
  }

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const desktopId = useId();
  const mobileId = useId();

  const activeCount = countActiveFilters(localFilters);

  const applyFilters = (next: ProductFilters) => {
    setLocalFilters(next);

    const query = buildProductFilterQuery(next);
    const href = query ? `${pathname}?${query}` : pathname;

    startTransition(() => {
      router.push(href, { scroll: false });
    });
  };

  const clearFilters = () => {
    applyFilters({
      colors: [],
      minPrice: undefined,
      maxPrice: undefined,
      sort: localFilters.sort,
    });
  };

  const closeMobile = () => {
    setIsMobileOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  /* While the sheet is open: lock the page behind it, move focus into it, keep
     Tab inside it, and close on Escape. Growing to the desktop layout closes it. */
  useEffect(() => {
    if (!isMobileOpen) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());

    const desktop = window.matchMedia("(min-width: 1024px)");
    const onDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setIsMobileOpen(false);
    };
    desktop.addEventListener("change", onDesktop);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMobileOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key !== "Tab") return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select, input',
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
      window.cancelAnimationFrame(frame);
      desktop.removeEventListener("change", onDesktop);
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [isMobileOpen]);

  return (
    <>
      <aside className="hidden lg:block" aria-label="Product filters">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
              Filters
            </h2>
            {isPending ? (
              <span
                role="status"
                className="text-xs font-medium text-muted"
              >
                Updating…
              </span>
            ) : null}
          </div>

          <FilterControls
            idPrefix={desktopId}
            availableColors={availableColors}
            filters={localFilters}
            onChange={applyFilters}
            onClear={clearFilters}
          />
        </div>
      </aside>

      <div className="lg:hidden">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsMobileOpen(true)}
          aria-expanded={isMobileOpen}
          aria-controls="product-filter-drawer"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground shadow-card transition-colors duration-150 ease-out hover:border-primary/40 hover:text-primary active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <SlidersHorizontal size={17} strokeWidth={2} aria-hidden="true" />
          Filters
          {activeCount > 0 ? (
            <span
              aria-label={`${activeCount} active ${
                activeCount === 1 ? "filter" : "filters"
              }`}
              className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[0.6875rem] font-semibold text-background"
            >
              {activeCount}
            </span>
          ) : null}
        </button>
      </div>

      <AnimatePresence>
        {isMobileOpen ? (
          <div key="product-filters" className="fixed inset-0 z-[60] lg:hidden">
            <motion.div
              aria-hidden="true"
              onClick={closeMobile}
              className="absolute inset-0 bg-charcoal/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            />

            <motion.div
              ref={panelRef}
              id="product-filter-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="product-filter-title"
              aria-busy={isPending}
              className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-3xl bg-background shadow-panel"
              initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
              animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
              exit={
                reduceMotion
                  ? { opacity: 0, transition: { duration: 0.15 } }
                  : {
                      y: "100%",
                      transition: { duration: 0.22, ease: "easeOut" },
                    }
              }
              transition={{ type: "spring", duration: 0.4, bounce: 0 }}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
                <h2
                  id="product-filter-title"
                  className="font-serif text-xl font-semibold tracking-tight text-foreground"
                >
                  Filters
                </h2>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={closeMobile}
                  aria-label="Close filters"
                  className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors duration-150 ease-out hover:bg-foreground/5 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <X size={22} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                <FilterControls
                  idPrefix={mobileId}
                  availableColors={availableColors}
                  filters={localFilters}
                  onChange={applyFilters}
                  onClear={clearFilters}
                />
              </div>

              <div className="shrink-0 border-t border-border bg-background px-5 py-4">
                <button
                  type="button"
                  onClick={closeMobile}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-background transition-colors duration-150 ease-out hover:bg-primary-deep active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {isPending ? "Updating…" : "Show results"}
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
