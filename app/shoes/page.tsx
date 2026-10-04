import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Shoes",
  description:
    "Handmade leather shoes, cut and stitched in Nairobi. Goodyear-welted and built to be resoled.",
};

/**
 * The shoes stub.
 *
 * Deliberately a page and not a 404: the nav already advertises the category,
 * and a link that dies is worse than a link that explains itself. It states
 * what is coming and how to reach the workshop in the meantime, and carries no
 * product grid — there is nothing to grid yet.
 */
export default function ShoesPage() {
  return (
    <main id="main" className="flex flex-1">
      <div className="mx-auto flex w-full max-w-6xl flex-col justify-center px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <p className="stitch h-px w-10 text-accent" aria-hidden="true" />

        <h1 className="mt-6 max-w-2xl font-serif text-4xl leading-[1.05] font-semibold tracking-tight text-foreground text-balance sm:text-5xl">
          Shoes are on the bench
        </h1>

        <p className="mt-4 max-w-md text-pretty leading-relaxed text-muted">
          We are cutting and stitching the first pairs now. The bags are ready
          today — start there, and we will have shoes for you soon.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/bags"
            className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold tracking-wide text-background transition-colors duration-150 ease-out hover:bg-primary-deep active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            Shop bags
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center rounded-full border border-border px-6 py-3 text-sm font-semibold tracking-wide text-foreground transition-colors duration-150 ease-out hover:bg-card active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            Ask us to let you know
          </Link>
        </div>
      </div>
    </main>
  );
}