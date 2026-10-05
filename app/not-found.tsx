import Link from "next/link";
import { Compass } from "lucide-react";

/**
 * The 404.
 *
 * Served by `notFound()` from `/bags/[slug]` and `/shoes/[slug]` when a slug
 * does not resolve, and by the router for any URL that matches no route.
 *
 * Design notes — what makes a 404 worth having:
 *
 * - It does not apologise. "We couldn't find that page" states the fact and stops.
 *   A wall of apology on a page the shopper reached by mistyping makes a typo feel
 *   like their mistake twice.
 * - It offers exactly two ways out, both of them somewhere useful. A 404 that only
 *   offers "go home" is a dead end; one that offers Home and Bags is a routing
 *   desk.
 * - `main` carries `id="main"`, matching every other page, because the navbar's
 *   skip link points at it. Without that attribute the skip link would focus
 *   nothing at all on the one page where somebody using a keyboard is most likely
 *   to want it.
 * - `flex-1` on a column body means this centres within the leftover space rather
 *   than sticking to the top, so the two links land near the middle rather than
 *   under the navbar with a screenful of empty cream below.
 *
 * No client code. A 404 must render even when something has thrown, so the fewer
 * boundaries it needs the better.
 */

export default function NotFound() {
  return (
    <main id="main" className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:px-6 sm:py-28">
      {/* The compass is the one piece of iconography: it says "you are off the
          map" in a shop that otherwise uses almost no icons. Decorative — the
          heading below carries the meaning. */}
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-full border border-border bg-card text-accent sm:size-16"
      >
        <Compass className="size-6 sm:size-7" strokeWidth={1.5} />
      </span>

      <p className="mt-6 font-mono text-xs tracking-[0.2em] text-muted uppercase">
        404
      </p>

      <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl md:text-5xl">
        We couldn&rsquo;t find that page
      </h1>

      <p className="mt-4 max-w-md text-pretty leading-relaxed text-muted">
        The link may be out of date, or the piece may have been retired. The bags
        and shoes are all still here.
      </p>

      {/* Primary is Bags, not Home. Somebody who followed a dead product link was
          shopping; they want the shop, not the front door. */}
      <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
        <Link
          href="/bags"
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-primary px-8 text-sm font-semibold text-background transition-colors duration-200 ease-out hover:bg-primary-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
        >
          Browse bags
        </Link>
        <Link
          href="/"
          className="inline-flex h-12 w-full items-center justify-center rounded-full border border-primary px-8 text-sm font-semibold text-primary transition-colors duration-200 ease-out hover:bg-primary hover:text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}