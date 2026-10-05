import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { ProductCard } from "@/components/product/ProductCard";
import { ProductGrid } from "@/components/product/ProductGrid";
import { getFeaturedProducts, getNewArrivals, getProducts } from "@/lib/api";

/**
 * ---------------------------------------------------------------------------
 * HOW THE HOME PAGE STAYS CURRENT
 * ---------------------------------------------------------------------------
 * Two sections here pull products in, and they pull in completely differently.
 * Keep that difference, because it is the whole design of this page.
 *
 * 1. "Featured" — manual curation. It renders exactly the products with
 *    `featured: true`, in the order the admin returns them. Nothing on the page
 *    promotes a product into it, and nothing demotes one out. A bag sits in the
 *    featured rail because a person put it there, and it stays there until a
 *    person takes it out. If the rail looks wrong, the fix is in the admin,
 *    never in this file.
 *
 * 2. "New Arrivals" — automatic. It is the newest N products by `createdAt`,
 *    descending. Adding a product in the admin is the entire publishing
 *    process for this section: it appears on the next build, at the top, and
 *    falls off the bottom once `limit` newer products have landed.
 *
 * There is deliberately **no cron job and no daily shuffle.** Freshness comes
 * from new stock, not from rotation. A bag that has not changed in four months
 * should still be on the home page in four months; a "trending now" rail that
 * reorders itself on a timer tells the shopper nothing true about the workshop,
 * and it makes every visit look different from the last. If a section ever does
 * need to change on its own, that is a deliberate new feature with a reason
 * behind it — not something to add by default.
 *
 * The practical consequence for future-me: a stale "New Arrivals" grid almost
 * never means the sorting is broken. It means nothing new has been added.
 * Check `createdAt` in the admin before touching the code.
 *
 * One more thing. The two sections take different paths through `lib/api.ts` on
 * purpose — `getFeaturedProducts()` and `getNewArrivals(limit)` rather than one
 * fat `getHomePageData()`. When the real API lands, the featured query and the
 * new-arrivals query will cache differently (the featured rail changes when a
 * human edits it, the arrivals grid changes on every write), and separate
 * functions are the only way that stays visible.
 * ---------------------------------------------------------------------------
 */

export default async function Home() {
  /* Three reads, all through the api seam. `Promise.all` because they are
     independent requests the moment any of them is a real fetch. */
  const [featured, newArrivals, bags, shoes] = await Promise.all([
    getFeaturedProducts(),
    getNewArrivals(8),
    getProducts("bag"),
    getProducts("shoe"),
  ]);

  /* Previewed rather than hand-picked: the newest of each category, so these two
     sections move on their own in step with "New Arrivals" above them. */
  const bagPreview = bags.slice(0, 4);
  const shoePreview = shoes.slice(0, 4);

  return (
    <main id="main" className="flex-1">
      {/* ------------------------------------------------------------------
          Hero. A brown band the width of the page, directly under the bar of
          the same colour, so the two read as one block of leather rather than
          a nav and then a banner.
          ------------------------------------------------------------------ */}
      <section className="bg-primary text-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          {/* The saddle-stitch rule, used here as a structural marker rather
              than decoration: it is the same mark that sits under the active
              nav link, so the page opens by quoting the brand's own rule. */}
          <p className="stitch h-px w-12 text-accent" aria-hidden="true" />

          <h1 className="mt-6 max-w-3xl font-serif text-[2.25rem] leading-[1.06] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Single-hide leather, hand-stitched in Nairobi
          </h1>

          <p className="mt-5 max-w-xl text-pretty leading-relaxed text-background/75">
            Every bag is cut from one hide and sewn by hand in our workshop — no
            bonded panels, no lining that hides the seams.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/bags"
              className="inline-flex min-h-11 items-center rounded-full bg-accent px-6 py-3 text-sm font-semibold tracking-wide text-primary transition-colors duration-150 ease-out hover:bg-accent-ink active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-background"
            >
              Shop bags
            </Link>
            <Link
              href="/shoes"
              className="inline-flex min-h-11 items-center rounded-full border border-background/30 px-6 py-3 text-sm font-semibold tracking-wide text-background transition-colors duration-150 ease-out hover:border-background/60 hover:bg-background/10 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-background"
            >
              Shop shoes
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          Featured rail. Scrolls horizontally everywhere; from `lg` the four
          cards are exactly as wide as the grid above, so the rail and the
          grid below it share a column grid without anyone having to line them
          up.
          ------------------------------------------------------------------ */}
      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <h2 className="font-sans text-xs font-semibold tracking-[0.16em] text-muted uppercase">
          Featured
        </h2>

        {featured.length > 0 ? (
          <ul
            /* `scroll-pl-*` matches the `px-*` bleed. Without it, a snapped card
               aligns to the scroller's border box and ends up 16px further left
               than the same card at rest. */
            className="scrollbar-none -mx-4 mt-6 flex snap-x snap-mandatory scroll-pl-4 gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:gap-4 sm:scroll-pl-6 sm:px-6 lg:mx-0 lg:gap-6 lg:scroll-pl-0 lg:px-0"
            /* The rail is its own tab stop so a keyboard shopper can scroll it
               without tabbing through all four cards first. */
            tabIndex={0}
            aria-label="Featured products"
          >
            {featured.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                /* Fixed width and `shrink-0` so the rail overflows and scrolls
                   on a phone; `grow` + `basis-0` from `lg` so the four cards
                   divide the row evenly and line up with the grid below. */
                className="w-[68vw] max-w-[15rem] shrink-0 snap-start sm:w-[19rem] lg:w-auto lg:max-w-none lg:grow lg:basis-0"
              />
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-muted">Nothing is featured yet.</p>
        )}
      </section>

      {/* ------------------------------------------------------------------
          New arrivals. Automatic: newest by `createdAt`, no curation.
          ------------------------------------------------------------------ */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8">
        <h2 className="font-sans text-xs font-semibold tracking-[0.16em] text-muted uppercase">
          New arrivals
        </h2>

        <div className="mt-6">
          <ProductGrid
            products={newArrivals}
            emptyMessage="Nothing new has arrived yet. The bags below are everything we make."
          />
        </div>

        <div className="mt-8">
          <Link
            href="/bags"
            className="group inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold tracking-wide text-foreground transition-colors duration-150 ease-out hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            View all bags
            <ArrowRight
              size={16}
              strokeWidth={2}
              aria-hidden="true"
              className="transition-transform duration-150 ease-out group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          The two categories. Both are real grids now that shoes have launched, and
          both are pinned to two columns — this split is half a page wide, so the
          responsive shop grid would try to fit four cards in a 528px column and
          crush all of them.
          ------------------------------------------------------------------ */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
        {/* Stacked until `lg`, not `md`: two columns at 768px leave each preview card
            about 146px, which is too narrow for a product name and a price on
            the same line. Two columns need 1024px to work. */}
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-8">
          {/* Both columns are `flex h-full flex-col` and the "Shop X" link is
              `mt-auto`. This split used to be balanced by a fixed-height
              placeholder on the shoes side, which is no longer there — with two
              real grids of differing content, the columns came out different
              heights and the two links landed 50px apart, which reads as a
              mistake rather than as two columns. `mt-auto` pins both links to the
              same baseline, and `items-stretch` (the grid default) gives both
              columns the full row height to distribute. */}
          <div className="flex h-full flex-col">
            <h2 className="font-sans text-xs font-semibold tracking-[0.16em] text-muted uppercase">
              Bags
            </h2>

            <div className="mt-6 flex-1">
              {/* Pinned to two: this grid already sits in half a page, and the
                  responsive shop grid would try to fit four cards in a 528px
                  column and crush all of them. */}
              <ProductGrid products={bagPreview} columns={2} className="h-full" />
            </div>

            <div className="mt-6">
              <Link
                href="/bags"
                className="group inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold tracking-wide text-foreground transition-colors duration-150 ease-out hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                Shop bags
                <ArrowRight
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                />
              </Link>
            </div>
          </div>

          <div className="flex h-full flex-col">
            <h2 className="font-sans text-xs font-semibold tracking-[0.16em] text-muted uppercase">
              Shoes
            </h2>

            {/* Was a "not on sale yet" panel while shoes were still on the bench.
                It is now the same real grid as bags, because shoes *are* on sale
                and the stub was quietly lying about it — and it sat directly
                below a nav item and above a footer link that both said the
                opposite. A placeholder that contradicts its own site is worse
                than no placeholder. */}
            <div className="mt-6 flex-1">
              <ProductGrid products={shoePreview} columns={2} className="h-full" />
            </div>

            <div className="mt-6">
              <Link
                href="/shoes"
                className="group inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold tracking-wide text-foreground transition-colors duration-150 ease-out hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                Shop shoes
                <ArrowRight
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}