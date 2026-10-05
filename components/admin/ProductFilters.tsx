"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * The filter chips above the product table.
 *
 * State lives in the URL, not in React. Two reasons, both about the browser rather
 * than about React:
 *
 *   1. **The Back button works.** Filters held in state are a place the Back button
 *      cannot reach, and "Back should undo my filter" is what a person pressing Back
 *      expects. `router.push` on each change puts it in history.
 *   2. **The page stays server-rendered.** The list is a server component reading
 *      `searchParams`, so there is no client-side copy of the product list to keep in
 *      step with the database. That is the whole point of reading through
 *      `lib/admin-api.ts`.
 *
 * `useSearchParams` requires a `<Suspense>` boundary around it — see the page, which
 * wraps this. Without one, Next refuses to statically render the route.
 */

/** Kept in step with the `category` prop on `listProducts`. */
type Filter = "all" | "bag" | "shoe";

/**
 * How long to wait after the last keystroke before searching.
 *
 * 300ms: long enough that typing "weekender" is one search rather than nine, short
 * enough that the results feel attached to the typing.
 */
const DEBOUNCE_MS = 300;

const CHIPS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "bag", label: "Bags" },
  { value: "shoe", label: "Shoes" },
];

export function ProductFilters({
  counts,
}: {
  /** How many products are in each category, for the chip labels. */
  counts: Record<Filter, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = (searchParams.get("category") ?? "all") as Filter;
  const currentSearch = searchParams.get("q") ?? "";

  const setParams = (next: { category?: Filter; q?: string }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (next.category === undefined) params.delete("category");
    else if (next.category === "all") params.delete("category");
    else params.set("category", next.category);

    if (next.q === undefined || next.q === "") params.delete("q");
    else params.set("q", next.q);

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div
        role="group"
        aria-label="Filter by type"
        className="inline-flex rounded-full border border-border bg-card p-1"
      >
        {CHIPS.map((chip) => {
          const active = current === chip.value;

          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={active}
              onClick={() => setParams({ category: chip.value })}
              className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                active
                  ? "bg-primary text-background"
                  : "text-muted hover:bg-primary/8 hover:text-foreground"
              }`}
            >
              {chip.label}
              <span className={`tabular-nums ${active ? "text-background/70" : "text-muted/70"}`}>
                {counts[chip.value]}
              </span>
            </button>
          );
        })}
      </div>

      <SearchInput
        value={currentSearch}
        onChange={(value) => setParams({ q: value })}
        onClear={() => setParams({ q: "" })}
      />
    </div>
  );
}

/**
 * The search box.
 *
 * Debounced by 300ms, because one keystroke means one URL change means one server
 * render means one database query, and a person typing "weekender" should cause one
 * search rather than ten.
 *
 * The value is local state that syncs *out* to the URL, not a controlled input bound
 * to the URL. Binding both ways means every keystroke fights the router for
 * ownership of the field, and the cursor jumps as the value round-trips through
 * navigation. So: local state is the source of truth while typing, and the URL catches
 * up when the debounce settles.
 *
 * The one exception is a value already in the URL — a shared link, or Back — which
 * seeds the field through the effect below.
 */
function SearchInput({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState(value);

  /* The value the draft was last derived from. Compared during render rather than
     watched in an effect: when the URL changes underneath — Back, or a shared link —
     this adjusts the field in the same render, with no intermediate frame where the
     box shows the old word, and no cascading render from a setState inside an effect.

     `lastSynced` is what makes it idempotent: without it the adjustment would fire on
     every render, because `draft` being set is not what is being compared — `value`
     is, and it stops changing once it has been adopted. */
  const [lastSynced, setLastSynced] = useState(value);
  if (value !== lastSynced) {
    setLastSynced(value);
    setDraft(value);
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const push = (next: string) => {
    setDraft(next);
    setLastSynced(next);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(next), DEBOUNCE_MS);
  };

  return (
    <div className="relative w-full sm:w-64">
      <label htmlFor="product-search" className="sr-only">
        Search products by name
      </label>

      <input
        id="product-search"
        type="search"
        value={draft}
        onChange={(event) => push(event.target.value)}
        onKeyDown={(event) => {
          /* Enter applies immediately rather than making somebody wait out the
             debounce they just overrode by pressing a key. */
          if (event.key === "Enter") {
            if (timer.current) clearTimeout(timer.current);
            onChange(draft);
          }
          if (event.key === "Escape" && draft) {
            setDraft("");
            setLastSynced("");
            onClear();
          }
        }}
        placeholder="Search products"
        className="h-10 w-full rounded-full border border-border bg-card pr-9 pl-4 text-sm text-foreground transition-colors duration-150 ease-out placeholder:text-muted/60 focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />

      {draft ? (
        <button
          type="button"
          onClick={() => {
            setDraft("");
            setLastSynced("");
            onClear();
          }}
          aria-label="Clear search"
          className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted transition-colors duration-150 ease-out hover:bg-primary/8 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </div>
  );
}