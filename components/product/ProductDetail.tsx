"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { angleAt } from "@/lib/angles";
import { categoryName as categoryNameFor, categoryPath as categoryPathFor } from "@/lib/category";
import { effectivePrice, hasDiscount } from "@/lib/format";
import type { CartItem, Product } from "@/lib/types";

import { useSharedImageTransition } from "@/components/motion/SharedImageTransition";
import { AddToCartButton } from "@/components/product/AddToCartButton";
import { AngleSwiper } from "@/components/product/AngleSwiper";
import { ColorSwatches } from "@/components/product/ColorSwatches";
import { DiscountBadge, PriceRow } from "@/components/product/PriceRow";
import { QuantityStepper } from "@/components/ui/QuantityStepper";

/** Matches `MAX_QUANTITY_PER_ITEM` in the cart store. */
const MAX_QUANTITY = 10;
/* The standard Material curve. The morph is transform-only, so it stays on the
   compositor; `cubic-bezier(0.2, 0, 0, 1)` is the curve that reads as "the same
   object moved" rather than "a new object appeared". */
const MORPH_EASING = "cubic-bezier(0.2, 0, 0, 1)";
const MORPH_MS = 420;

type ProductDetailProps = {
  product: Product;
};

/**
 * The product page body.
 *
 * A server component fetches the product and hands it here; this owns the colour,
 * angle and quantity state and plays the arrival transition.
 */
export function ProductDetail({ product }: ProductDetailProps) {
  const reduceMotion = useReducedMotion();
  const { peek, release } = useSharedImageTransition();

  /* Read the card's snapshot while rendering, so the colour the shopper was
     looking at on the grid is the one the page opens on. If that colour sold
     out between the grid render and this navigation, open on the first colour
     that can actually be bought. */
  const [snapshot] = useState(() => peek(product.id));

  const [activeColorId, setActiveColorId] = useState(() => {
    const preferred = product.colors[snapshot?.colorIndex ?? 0];
    if (preferred && preferred.stockQuantity > 0) return preferred.id;
    return product.colors.find((entry) => entry.stockQuantity > 0)?.id ?? "";
  });
  const [angleIndex, setAngleIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  /* The wrapper carries the arrival morph. It was once also the element with
     the card's `layoutId`; that is gone (see `SharedImageTransition.tsx`), so
     nothing competes for this element's transform now. */
  const morphRef = useRef<HTMLDivElement>(null);
  const [hasArrived, setHasArrived] = useState(!snapshot);

  /* The shop hides sold-out colours everywhere, but filtering again here keeps
     the component honest if it is ever handed an unfiltered product. */
  const availableColors = product.colors.filter((entry) => entry.stockQuantity > 0);
  const color =
    availableColors.find((entry) => entry.id === activeColorId) ??
    availableColors[0] ??
    product.colors[0];

  /* Snapshots are single-use: drop this one once the page has read it. */
  useEffect(() => {
    if (snapshot) release(product.id);
  }, [product.id, release, snapshot]);

  /* Arrival morph. Measured and started in a layout effect, so the browser never
     paints the image at full size before it jumps back to the card's position —
     the first frame the shopper sees is already the start of the morph. */
  useLayoutEffect(() => {
    const element = morphRef.current;
    if (reduceMotion || !snapshot || !element) {
      setHasArrived(true);
      return;
    }

    const target = element.getBoundingClientRect();
    if (target.width === 0 || target.height === 0) {
      setHasArrived(true);
      return;
    }

    /* Translate by the gap between the two centres so the image grows out of the
       card rather than out of its own top-left corner. */
    const x = snapshot.left + snapshot.width / 2 - (target.left + target.width / 2);
    const y = snapshot.top + snapshot.height / 2 - (target.top + target.height / 2);
    const scaleX = snapshot.width / target.width;
    const scaleY = snapshot.height / target.height;

    /* `fill: backwards` makes the browser paint the first keyframe immediately,
       which is what removes the one-frame flash. Cancellable, so a second
       navigation mid-morph does not fight it. */
    const animation = element.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})` },
        { transform: "translate(0px, 0px) scale(1, 1)" },
      ],
      { duration: MORPH_MS, easing: MORPH_EASING, fill: "backwards" },
    );

    const finish = () => {
      animation.cancel();
      element.style.transform = "";
      setHasArrived(true);
    };

    animation.addEventListener("finish", finish);
    return () => {
      animation.cancel();
      animation.removeEventListener("finish", finish);
    };
  }, [reduceMotion, snapshot]);

  const maxQuantity = Math.min(
    MAX_QUANTITY,
    Math.max(1, color?.stockQuantity ?? 1),
  );

  if (!color) return null;

  const selectColor = (colorId: string) => {
    const next = availableColors.find((entry) => entry.id === colorId);
    if (!next) return;

    setActiveColorId(next.id);
    setAngleIndex(0);
    /* Lowering the ceiling must lower the current value with it, or a shopper
       could carry a quantity of 4 into a colour that has 1 left. */
    setQuantity((current) =>
      Math.min(current, MAX_QUANTITY, Math.max(1, next.stockQuantity)),
    );
  };

  /* The one place the "where did you come from" link and its label are decided,
     so a shoe page says "All shoes" and links to /shoes without this component
     knowing it is being rendered under /bags or /shoes. */
  const categoryPath = categoryPathFor(product.category);
  const categoryName = categoryNameFor(product.category);

  /* The cart line, assembled where all its pieces live. */
  const cartItem: CartItem = {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    colorId: color.id,
    colorName: color.name,
    colorHex: color.hex,
    unitPrice: effectivePrice(product.basePrice, product.discountPercent),
    basePrice: product.basePrice,
    quantity,
    stockQuantity: color.stockQuantity,
    /* `angleAt` clamps, so a stale index from a previous product can never
       address an angle this product does not have. */
    image: color.images[angleAt(angleIndex, product.angles)] ?? color.images.front ?? null,
  };

  return (
    <main id="main" className="flex-1">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <Link
          href={categoryPath}
          className="-ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-2 text-sm font-medium text-muted transition-colors duration-150 ease-out hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
          All {categoryName}
        </Link>

        <div className="mt-4 grid gap-8 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
          {/* Image. Sticky on desktop so every view stays reachable while the
              shopper reads. */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div
              ref={morphRef}
              /* Hidden only for the frame between commit and measurement, which
                 the browser never paints. */
              style={{ visibility: hasArrived ? "visible" : "hidden" }}
            >
              <div>
                <div className="relative">
                  <AngleSwiper
                    productName={product.name}
                    color={color}
                    angles={product.angles}
                    angleIndex={angleIndex}
                    onAngleChange={setAngleIndex}
                  />

                  {hasDiscount(product.discountPercent) ? (
                    <DiscountBadge
                      discountPercent={product.discountPercent}
                      className="absolute top-3 right-3"
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Details. Fades up behind the morph rather than competing with it. */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduceMotion ? 0 : 0.3,
              ease: "easeOut",
              delay: reduceMotion ? 0 : 0.08,
            }}
            className="flex flex-col gap-6 lg:pt-1"
          >
            <header>
              <h1 className="text-pretty font-serif text-4xl leading-tight font-semibold tracking-tight text-foreground sm:text-5xl">
                {product.name}
              </h1>

              <PriceRow
                basePrice={product.basePrice}
                discountPercent={product.discountPercent}
                size="detail"
                basePriceUsd={product.basePriceUsd}
                className="mt-3"
              />
            </header>

            <p className="text-pretty leading-relaxed text-muted">
              {product.description}
            </p>

            <section aria-label="Colour">
              <ColorSwatches
                colors={availableColors}
                activeColorId={color.id}
                onSelect={selectColor}
                size="lg"
                showActiveName
              />
            </section>

            <div className="flex w-full flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
              <QuantityStepper
                value={quantity}
                onChange={setQuantity}
                max={maxQuantity}
              />

              <AddToCartButton item={cartItem} />
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}