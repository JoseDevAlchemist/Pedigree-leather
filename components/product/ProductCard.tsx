"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRef, useState } from "react";

import { angleSpoken, stepIndex } from "@/lib/angles";
import { productHref } from "@/lib/category";
import { formatPrice, hasDiscount } from "@/lib/format";
import type { Product } from "@/lib/types";

import { useHoverAngleRoll, CROSSFADE_MS } from "@/hooks/useHoverAngleRoll";
import { useInViewAutoRoll } from "@/hooks/useInViewAutoRoll";
import { useHasHover } from "@/hooks/useMediaQuery";
import { useSharedImageTransition } from "@/components/motion/SharedImageTransition";
import { AngleDots } from "@/components/product/AngleDots";
import { ColorSwatches } from "@/components/product/ColorSwatches";
import { DiscountBadge, PriceRow } from "@/components/product/PriceRow";
import { ProductImage } from "@/components/product/ProductImage";

/* Lift is a desktop affordance: a phone has no hover, so a scale that nothing
   can cancel would just fight the tap. */
const cardVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.02 },
} as const;

/* The elevation change is a cross-fade of the shadow token rather than an
   animated box-shadow value, because a shadow cannot be interpolated from
   `var()`. Opacity is compositor-only; box-shadow is not. */
const liftVariants = {
  rest: { opacity: 0 },
  hover: { opacity: 1, transition: { duration: 0.2, ease: "easeOut" } },
} as const;

type ProductCardProps = {
  product: Product;
  /**
   * Applied to the card itself. The home page's featured rail sets a width here
   * so a carousel card can be larger than a grid card without a second card
   * component.
   */
  className?: string;
};

/**
 * A product in the grid.
 *
 * The whole card is one link, built as a stretched overlay rather than a link
 * wrapped around the content — that keeps the swatches independently clickable
 * and focusable, which nesting them inside a link would have made impossible.
 *
 * Angle and colour are local state. The grid is a browsing surface, and pushing
 * six cards' colour choices around as the shopper browses would be noise. The
 * colour they were looking at is handed to the detail page through the shared
 * transition, so the page opens on what they picked.
 *
 * Two densities, one component. Under `sm` the grid is two columns wide, so the
 * card drops its description, tightens its padding and stacks the price above
 * the swatches — a row holding "KES 11,900" and four swatches cannot fit in
 * 141px without wrapping the price mid-number. From `sm` up it is the roomier
 * card the desktop grid was designed around.
 */
export function ProductCard({ product, className = "" }: ProductCardProps) {
  const reduceMotion = useReducedMotion();
  const { capture } = useSharedImageTransition();
  const imageRef = useRef<HTMLDivElement>(null);

  const [colorIndex, setColorIndex] = useState(0);

  const color = product.colors[colorIndex] ?? product.colors[0];
  const angleCount = product.angles.length;
  const isSoldOut = product.stockQuantity === 0;

  /* Two roll triggers, both always running, chosen by what the input device can
     do rather than by viewport width. A phone has no pointer to hover with, so
     it gets the in-view roll; anything with a real cursor gets the hybrid one.
     `hasHover` is false on the server and the first client render, so both hooks
     start inert and settle on the second — see `useMediaQuery`. */
  const hasHover = useHasHover();

  /* The card itself, for the in-view roll on a phone. Separate from
     `imageRef`, which measures the picture for the hover zones: a card is taller
     than its image, and the two want different boxes. */
  const cardRef = useRef<HTMLLIElement | null>(null);

  const hover = useHoverAngleRoll({
    angleCount,
    angles: product.angles,
    mode: "hybrid",
    /* Zones describe the picture, so they are measured against the picture —
       the card is taller than its image and the bottom third of the photo would
       otherwise land in the middle of the card. */
    surfaceRef: imageRef,
  });

  const inView = useInViewAutoRoll({
    angleCount,
    enabled: !hasHover,
    targetRef: cardRef,
  });

  /* The arrow keys on the stretched link are the one input that is neither a
     hover nor a scroll, so their result is held separately and takes precedence
     while it lasts. `null` means "no override, follow the roll". Leaving the
     card clears it, which hands control back to the roll — and the roll's own
     reset to front, with its slower 250ms fade, is what the shopper sees. */
  const [manualAngleIndex, setManualAngleIndex] = useState<number | null>(null);

  const rollAngleIndex = hasHover ? hover.currentAngleIndex : inView.currentAngleIndex;

  const angleIndex = manualAngleIndex ?? rollAngleIndex;
  /* `angleAt` inlined: this value is derived from the roll hook's
     `currentAngleIndex`, and the React lint rules read anything named
     `current*` on a hook result as a ref and reject passing it to a function
     during render. Same clamp either way. */
  const angle = product.angles[angleIndex] ?? product.angles[0];

  /* Slower only for the roll's own reset to front; a keyboard step or an in-view
     roll is an ordinary change of view. */
  const fadeMs = manualAngleIndex === null ? hover.fadeMs : CROSSFADE_MS;

  const stepManually = (delta: number) => {
    setManualAngleIndex((index) => stepIndex(index ?? rollAngleIndex, delta, angleCount));
  };

  const handleMouseLeave = () => {
    setManualAngleIndex(null);
    hover.handlers.onMouseLeave();
  };

  const handleOpen = (event: React.MouseEvent<HTMLAnchorElement>) => {
    /* Let the browser handle modified clicks — they open a new tab, and a new
       tab must not inherit this tab's measured rect. */
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }
    if (imageRef.current) capture(product.id, imageRef.current, colorIndex);
  };

  return (
    <motion.li
      ref={cardRef}
      variants={cardVariants}
      initial="rest"
      whileHover={reduceMotion ? undefined : "hover"}
      transition={{ type: "spring", duration: 0.3, bounce: 0 }}
      onMouseEnter={hover.handlers.onMouseEnter}
      onMouseMove={hover.handlers.onMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`group relative flex flex-col rounded-2xl bg-card shadow-card ${className}`}
    >
      {/* First in the DOM so the shadow paints behind everything else here. */}
      <motion.span
        aria-hidden="true"
        variants={reduceMotion ? cardVariants : liftVariants}
        className="pointer-events-none absolute inset-0 rounded-2xl shadow-card-lift"
      />

      {/* Image well. A plain div, deliberately: see the note in
          `SharedImageTransition.tsx` about why nothing here carries a
          `layoutId`.

          The well owns the aspect ratio, not the image. Every child below is
          `absolute inset-0`, which contributes no height — leaving the ratio on
          `ProductImage` gave this div a height of zero and collapsed the card. */}
      <div
        ref={imageRef}
        className="relative aspect-square overflow-hidden rounded-2xl"
        style={{ boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.06)" }}
      >
        {/* One layer per view that has been shown, cross-faded. Keyed on colour
            and angle together, so changing colour mid-roll restarts cleanly.

            `AnimatePresence` is what makes this a crossfade rather than a swap:
            the outgoing view stays mounted until its opacity has reached zero,
            so the two pictures overlap. Without it, `motion.div` would replace
            the element immediately and the change would read as a jump. Mode
            `sync` rather than `wait` — the incoming view must start fading in
            while the outgoing one is still fading out, or each step costs twice
            the duration.

            `initial={false}` matters twice over: the front view does not fade in
            on page load, and neither does it animate when a card scrolls into
            view on a phone, which would otherwise mean every card in the grid
            faded in at once on arrival. */}
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            key={`${color.id}-${angle}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : fadeMs / 1000, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <ProductImage
              /* `fill`, not `square`: the well above already carries the aspect
                 ratio, so the layer just fills it. */
              sizing="fill"
              src={color.images[angle] ?? null}
              hex={color.hex}
              colorName={color.name}
              productName={product.name}
              angle={angle}
            />
          </motion.div>
        </AnimatePresence>

        {/* No discount badge on a sold-out product: the price is not something
            the shopper can act on, and under the sold-out scrim the badge
            renders as a muddy patch rather than as a number. */}
        {!isSoldOut && hasDiscount(product.discountPercent) ? (
          <DiscountBadge
            discountPercent={product.discountPercent}
            className="absolute top-2 right-2 sm:top-3 sm:right-3"
          />
        ) : null}

        {isSoldOut ? (
          /* A dark scrim, not a cream one. `bg-card/70` bleached every colour
             to the same pale grey, which read as a photograph that failed to
             load rather than as a bag we have sold out of. */
          <div className="absolute inset-0 flex items-center justify-center bg-charcoal/25 backdrop-blur-[2px]">
            <span className="rounded-full border border-border bg-card/95 px-3 py-1 font-serif text-xs font-semibold text-foreground sm:px-4 sm:py-1.5 sm:text-sm">
              Sold out
            </span>
          </div>
        ) : null}

        {/* Development only. The roll is invisible while it works — the picture
            just changes — so while tuning zones and timings you need to see
            which view is live and where in the sequence you are. The
            `NODE_ENV` check is what keeps it out of the production bundle. */}
        {process.env.NODE_ENV === "development" ? (
          <span
            aria-hidden="true"
            className="absolute bottom-2 left-2 rounded-full bg-charcoal/75 px-2 py-1 font-mono text-[0.625rem] leading-none tabular-nums text-background"
          >
            {angleIndex + 1}/{angleCount} {angle}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 px-3 pt-3 pb-4 sm:gap-2.5 sm:px-4 sm:pt-3.5 sm:pb-5">
        <AngleDots activeIndex={angleIndex} angles={product.angles} align="start" />

        <h3 className="mt-0.5 font-serif text-base leading-snug font-semibold tracking-tight text-foreground sm:text-lg">
          {product.name}
        </h3>

        {/* Hidden rather than clamped on mobile: at two-up there are about
            fourteen characters per line, so a clamp would show a fragment.
            `sm:line-clamp-2` and not `sm:block` — `line-clamp` sets `display`
            itself, and a sibling `block` would win the cascade and uncap it. */}
        <p className="hidden text-sm leading-relaxed text-pretty text-muted sm:line-clamp-2">
          {product.description}
        </p>

        {/* Price and swatches share one row, and the row wraps as a whole rather than
            as words: a 254px card cannot hold "KES 14,850" and 140px of
            swatches side by side, and letting flex wrap *inside* the price
            broke the figure across lines ("KES" / "14,850" / "KES" / "16,500").
            `flex-wrap` here moves the whole swatch group to its own line
            instead, which is also the layout a 375px phone gets anyway. */}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pt-1.5">
          <PriceRow
            basePrice={product.basePrice}
            discountPercent={product.discountPercent}
            muted={isSoldOut}
            stacked
          />

          {/* Above the stretched link, so it stays clickable and focusable. */}
          <ColorSwatches
            colors={product.colors}
            activeColorId={color.id}
            onSelect={(colorId) =>
              setColorIndex(
                product.colors.findIndex((entry) => entry.id === colorId),
              )
            }
            disabled={isSoldOut}
            className="relative z-10 shrink-0"
          />
        </div>
      </div>

      {/* The one link for the whole card. Sits over the content but under the
          swatches, and takes the arrow keys so a keyboard shopper can step
          through every view without leaving the card. The category is part of
          the href so a shoe card does not try to open a bag page. */}
      <Link
        href={productHref(product.category, product.slug)}
        onClick={handleOpen}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            stepManually(1);
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            stepManually(-1);
          }
        }}
        className="absolute inset-0 z-[1] rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="sr-only">
          {`${product.name}, ${formatPrice(product.basePrice)}. View details.`}
        </span>
      </Link>

      {/* The dots above are decorative; this is what announces the state. */}
      <p className="sr-only" aria-live="polite">
        {`Showing ${angleSpoken(angle)} view of ${product.name} in ${color.name}`}
      </p>
    </motion.li>
  );
}