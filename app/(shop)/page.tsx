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

/**
 * A section heading: the label, then the brand's stitch rule running out to the
 * right edge of whatever column the section has.
 *
 * The rule is the part that does the work. These were `text-xs text-muted` — 12px
 * of muted brown on cream, about 4.5:1, which reads as a whisper from any normal
 * viewing distance. Larger and darker helps, but what actually marks a section
 * is the trailing rule: it gives the eye a line to stop on and ties the label to
 * the row of cards beneath it.
 *
 * `stitch` is the same dashed saddle-stitch mark that sits under the active nav
 * item and is quoted at the top of the hero, so this is the brand's existing
 * divider rather than a new one invented for headings. `flex-1` lets it fill
 * whatever width is available — the full container for Featured and New
 * arrivals, half for each column of the bags/shoes split — from one component,
 * which is why this is a component and not four hand-written h2s that would drift
 * apart again.
 */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <h2 className="shrink-0 font-sans text-sm font-semibold tracking-widest text-foreground uppercase">
        {children}
      </h2>
      <span aria-hidden="true" className="stitch h-px flex-1 text-accent/60" />
    </div>
  );
}

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
          Hero. A brown band the width of the page, under a navbar that is 2%
          darker. The two used to be the identical brown and read as one
          continuous block, so it was impossible to tell where the page began —
          the fix is `--pedigree-brown-dark` on the bar, not a border here.
          ------------------------------------------------------------------ */}
      <section className="bg-primary text-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          {/* The saddle-stitch rule, used here as a structural marker rather
              than decoration: it is the same mark that sits under the active
              nav link, so the page opens by quoting the brand's own rule. */}
          <p className="stitch h-px w-12 text-accent" aria-hidden="true" />

          {/* "Timeless leather goods, made by hand" over the other option.
              "Premium leather, crafted to last a lifetime" claims a superlative
              the shop cannot substantiate and runs long enough that
              `text-balance` splits it into four ragged lines at 6xl, which
              undercuts the confidence it is trying to sound. This is five words,
              covers bags and shoes in the same breath, and puts "made by hand" —
              the actual differentiator — last, where the eye lands. */}
          <h1 className="mt-6 max-w-3xl font-serif text-[2.25rem] leading-[1.06] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Timeless leather goods, made by hand
          </h1>

          {/* Names both categories explicitly. The old copy said "every bag",
              which read as a bag shop with a shoes page bolted on — and the
              second CTA goes to /shoes, so the copy contradicted the buttons
              under it. */}
          <p className="mt-5 max-w-xl text-pretty leading-relaxed text-background/75">
            Bags and shoes cut from high-quality hides, hand-stitched in our
            Nairobi workshop.
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
          Featured rail. A horizontal scroller at every width.

          The cards are a fixed comfortable width rather than dividing the
          row, and that is a change from the four-card version of this
          section. When exactly four bags were featured, dividing the row
          between them lined the cards up with the grid below, which looked
          deliberate. Then the rail gained shoes, seven featured products
          divided the same row into seven 135px cards, and the alignment was
          gone — along with any reason to think it would survive the next
          person to feature a fifth product.

          A carousel whose shape depends on how many products happen to be
          featured is a carousel that surprises whoever curates next. So:
          fixed width, always scrollable, and the cut-off card is the
          affordance. Two and a half cards at 1024px, three and a bit at
          1440px.
          ------------------------------------------------------------------ */}
      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <SectionHeading>Featured</SectionHeading>

        {featured.length > 0 ? (
          <ul
            /* `scroll-pl-*` matches the `px-*` bleed. Without it, a snapped card
               aligns to the scroller's border box and ends up 16px further left
               than the same card at rest. */
            className="scrollbar-none -mx-4 mt-6 flex snap-x snap-mandatory scroll-pl-4 gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:gap-4 sm:scroll-pl-6 sm:px-6 lg:mx-0 lg:gap-6 lg:scroll-pl-0 lg:px-0"
            /* The rail is its own tab stop so a keyboard shopper can scroll it
               without tabbing through every card first. */
            tabIndex={0}
            aria-label="Featured products"
          >
            {featured.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                /* Wider than a grid card at every width, which is what makes this a
                   carousel rather than a second grid. The `max-w` is the
                   mobile-only cap on `72vw`, so it has to be undone at
                   `sm` — `max-w` beats `w` whatever order they are written
                   in, and leaving it there silently pinned every card to
                   256px. */
                className="w-[72vw] max-w-[16rem] shrink-0 snap-start sm:w-[20rem] sm:max-w-none lg:w-[22rem]"
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
        <SectionHeading>New arrivals</SectionHeading>

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
            <SectionHeading>Bags</SectionHeading>

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
            <SectionHeading>Shoes</SectionHeading>

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