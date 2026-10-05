import Image from "next/image";

/**
 * The wordmark and the round logo, as two pieces.
 *
 * Both the navbar and the footer open with these, and they used to be private
 * functions inside the navbar — which meant the footer either imported from a
 * `"use client"` module or grew its own copy of the wordmark. The copy is the
 * failure mode: the wordmark is the one piece of brand typography that must be
 * identical everywhere it appears, and two copies of it drift the moment anyone
 * adjusts the tracking.
 *
 * Colour is fixed to `text-background` (cream) because both surfaces that use
 * these — the brown navbar and the charcoal footer — are dark. That is a
 * deliberate constraint rather than a default: it means the mark can never
 * accidentally land on the cream page as cream-on-cream.
 *
 * Size is the caller's job. `Wordmark` carries no size class of its own, because
 * two size utilities of the same breakpoint in one class string resolve by
 * stylesheet order rather than by intent, and the loser is whichever happened to
 * be written first.
 */

export function BrandMark({
  priority = false,
  className = "",
}: {
  /** Only for the navbar's instance, which is above the fold. */
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src="/pedigree-logo.png"
      alt=""
      width={40}
      height={40}
      priority={priority}
      className={`size-9 shrink-0 rounded-full outline outline-1 -outline-offset-1 outline-black/10 md:size-10 ${className}`}
    />
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-serif leading-none font-semibold tracking-tight text-background ${className}`}
    >
      Pedigree Leather
    </span>
  );
}