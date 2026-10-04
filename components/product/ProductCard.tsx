"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRef, useState } from "react";

import { ANGLES, angleLabel, stepIndex } from "@/lib/angles";
import { formatPrice, hasDiscount } from "@/lib/format";
import type { Product } from "@/lib/types";

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
 */
export function ProductCard({ product }: ProductCardProps) {
  const reduceMotion = useReducedMotion();
  const { capture } = useSharedImageTransition();
  const imageRef = useRef<HTMLDivElement>(null);

  const [angleIndex, setAngleIndex] = useState(0);
  const [colorIndex, setColorIndex] = useState(0);

  const color = product.colors[colorIndex] ?? product.colors[0];
  const angle = ANGLES[angleIndex];
  const isSoldOut = product.stockQuantity === 0;

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
      variants={cardVariants}
      initial="rest"
      whileHover={reduceMotion ? undefined : "hover"}
      transition={{ type: "spring", duration: 0.3, bounce: 0 }}
      className="group relative flex flex-col rounded-2xl bg-card shadow-card"
    >
      {/* First in the DOM so the shadow paints behind everything else here. */}
      <motion.span
        aria-hidden="true"
        variants={reduceMotion ? cardVariants : liftVariants}
        className="pointer-events-none absolute inset-0 rounded-2xl shadow-card-lift"
      />

      {/* Image well. Its `layoutId` is shared with the detail page. */}
      <div
        ref={imageRef}
        className="relative overflow-hidden rounded-2xl"
        style={{ boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.06)" }}
      >
        <motion.div layoutId={`card-image-${product.id}`}>
          <ProductImage
            sizing="square"
            src={color.images[angle] ?? null}
            hex={color.hex}
            colorName={color.name}
            productName={product.name}
            angle={angle}
          />
        </motion.div>

        {hasDiscount(product.discountPercent) ? (
          <DiscountBadge
            discountPercent={product.discountPercent}
            className="absolute top-3 right-3"
          />
        ) : null}

        {isSoldOut ? (
          <div className="absolute inset-0 flex items-center justify-center bg-card/70 backdrop-blur-[2px]">
            <span className="rounded-full border border-border bg-card/95 px-4 py-1.5 font-serif text-sm font-semibold text-foreground">
              Sold out
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 px-4 pt-3.5 pb-5">
        <AngleDots activeIndex={angleIndex} align="start" />

        <h3 className="mt-0.5 font-serif text-lg leading-snug font-semibold tracking-tight text-foreground">
          {product.name}
        </h3>

        <p className="line-clamp-2 text-sm leading-relaxed text-pretty text-muted">
          {product.description}
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-1.5">
          <PriceRow
            basePrice={product.basePrice}
            discountPercent={product.discountPercent}
            muted={isSoldOut}
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
          through the five angles without leaving the card. */}
      <Link
        href={`/bags/${product.slug}`}
        onClick={handleOpen}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            setAngleIndex((index) => stepIndex(index, 1));
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            setAngleIndex((index) => stepIndex(index, -1));
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
        {`Showing ${angleLabel(angle).toLowerCase()} view of ${product.name} in ${color.name}`}
      </p>
    </motion.li>
  );
}