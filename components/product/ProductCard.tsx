"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { angleSpoken, stepIndex } from "@/lib/angles";
import { SoldOutOverlay } from "./SoldOutOverlay";
import { productHref } from "@/lib/category";
import { effectivePrice, formatPrice, hasDiscount } from "@/lib/format";
import { useCartStore } from "@/lib/store/cart";
import type { CartItem, Product } from "@/lib/types";

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
  priority?: boolean;
  showDiscountBadge?: boolean;
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
export function ProductCard({ product, className = "", priority = false, showDiscountBadge = true }: ProductCardProps) {
  const reduceMotion = useReducedMotion();
  const { capture } = useSharedImageTransition();
  const imageRef = useRef<HTMLDivElement>(null);

  const [colorIndex, setColorIndex] = useState(0);

  const color = product.colors[colorIndex] ?? product.colors[0];
  const soldOut = !product.colors.some((entry) => entry.stockQuantity > 0);
  const angleCount = product.angles.length;

  const addItem = useCartStore((state) => state.addItem);

  const handleQuickAdd = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    /* Quick add is deliberately colour-blind: the card shows the first swatch as
       the default, so the line that lands in the cart is the same one the shopper
       would get by opening the product and pressing Add to Cart without touching
       a swatch. */
    const defaultColor = product.colors.find((entry) => entry.stockQuantity > 0);
    if (!defaultColor) return;

    const firstAngle = product.angles[0];
    const unitPrice = effectivePrice(product.basePrice, product.discountPercent);

    const line: CartItem = {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      colorId: defaultColor.id,
      colorName: defaultColor.name,
      colorHex: defaultColor.hex,
      unitPrice,
      basePrice: product.basePrice,
      quantity: 1,
      stockQuantity: defaultColor.stockQuantity,
      image: defaultColor.images[firstAngle] ?? null,
    };

    addItem(line);
    toast.success("Added to cart");
  };

  const [angleIndex, setAngleIndex] = useState(0);
  const angle = product.angles[angleIndex] ?? product.angles[0];
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const stepManually = (delta: number) => {
    setAngleIndex((index) => stepIndex(index, delta, angleCount));
  };

  const handleOpen = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (swiped.current && event.detail > 0) {
      swiped.current = false;
      event.preventDefault();
      return;
    }
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
      className={`group relative flex min-w-0 flex-col rounded-2xl bg-card shadow-card ${className}`}
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
        className="relative group aspect-[5/4] sm:aspect-square overflow-hidden rounded-2xl"
        style={{ boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.06)" }}
      >
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            key={`${color.id}-${angle}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
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
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority && angleIndex === 0 ? "high" : undefined}
              sizes="(min-width: 1024px) 270px, (min-width: 768px) 33vw, calc(50vw - 22px)"
            />
          </motion.div>
        </AnimatePresence>

        {/* Quick add-to-cart. Top right of the image well, as a sibling of the
            AnimatePresence layer so it is not part of the rect that
            `SharedImageTransition` measures for the card→detail morph. Always
            visible on mobile (there is no hover to reveal it); hidden until
            hover or keyboard focus on desktop, so it does not clutter a grid the
            shopper is only browsing. The discount chip lives top-left so the two
            never collide. */}
        {soldOut && <SoldOutOverlay />}
        <button
          type="button"
          disabled={soldOut}
          onClick={handleQuickAdd}
          aria-label={`Add ${product.name} to cart`}
          className="absolute top-2 right-2 z-10 grid size-10 cursor-pointer place-items-center rounded-full bg-white/90 p-2 text-foreground shadow-md transition-[opacity,background-color,transform] duration-200 ease-out opacity-100 hover:bg-white active:scale-95 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-45 sm:top-3 sm:right-3"
        >
          <Plus size={18} strokeWidth={2} aria-hidden="true" />
          <span className="sr-only">{`Add ${product.name} to cart`}</span>
        </button>

        {showDiscountBadge && hasDiscount(product.discountPercent) ? (
          <DiscountBadge
            discountPercent={product.discountPercent}
            className="absolute top-2 left-2 sm:top-3 sm:left-3"
          />
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

      <div className="flex flex-1 flex-col gap-1 px-2 pt-2 pb-2 sm:gap-2.5 sm:px-4 sm:pt-3.5 sm:pb-5">
        <AngleDots activeIndex={angleIndex} angles={product.angles} align="start" />

        <h3 className="mt-0.5 font-serif text-sm leading-snug [overflow-wrap:anywhere] font-semibold tracking-tight text-foreground sm:text-lg">
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
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-2 gap-y-0 sm:gap-x-3 sm:gap-y-2 sm:pt-1.5">
          <PriceRow
            basePrice={product.basePrice}
            discountPercent={product.discountPercent}
            stacked
            basePriceUsd={product.basePriceUsd}
          />

          {/* Above the stretched link, so it stays clickable and focusable. */}
          <ColorSwatches
            colors={product.colors}
            activeColorId={color.id}
            onSelect={(colorId) => {
              setColorIndex(product.colors.findIndex((entry) => entry.id === colorId));
              setAngleIndex(0);
            }}
            className="relative z-10 min-w-0 max-w-full"
          />
        </div>
      </div>

      {/* The one link for the whole card. Sits over the content but under the
          swatches, and takes the arrow keys so a keyboard shopper can step
          through every view without leaving the card. The category is part of
          the href so a shoe card does not try to open a bag page. */}
      <Link
        href={productHref(product.category, product.slug)}
        prefetch={false}
        onClick={handleOpen}
        onPointerDown={(event) => {
          swiped.current = false;
          touchStart.current = event.pointerType === "touch" ? { x: event.clientX, y: event.clientY } : null;
        }}
        onPointerCancel={() => { touchStart.current = null; }}
        onPointerUp={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start) return;
          const delta = event.clientX - start.x;
          if (Math.abs(delta) < 35 || Math.abs(delta) <= Math.abs(event.clientY - start.y)) return;
          swiped.current = true;
          stepManually(delta < 0 ? 1 : -1);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            stepManually(1);
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            stepManually(-1);
          }
        }}
        className="absolute inset-0 z-[1] touch-pan-y rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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