"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { angleAt, angleSpoken, isFirstIndex, isLastIndex, stepIndex } from "@/lib/angles";
import type { Angle, ColorVariant } from "@/lib/types";

import { AngleDots } from "@/components/product/AngleDots";
import { ProductImage } from "@/components/product/ProductImage";

/* A swipe has to clear one of these to count. Both matter: a slow long drag and
   a short fast flick are both intentional, and neither distance nor velocity
   alone catches both. */
const SWIPE_DISTANCE = 48;
const SWIPE_VELOCITY = 380;

type AngleSwiperProps = {
  productName: string;
  color: ColorVariant;
  /** This product's views, in roll order. The swiper walks exactly these. */
  angles: readonly Angle[];
  angleIndex: number;
  onAngleChange: (index: number) => void;
  className?: string;
};

/**
 * Walks through one product's views by dragging.
 *
 * The drag is a gesture, not a carousel: the image nudges under the finger and
 * springs back, and releasing past the threshold commits the next angle, which
 * then cross-fades in. That keeps the views readable as separate images instead
 * of a filmstrip cropped mid-bag, and it means the photo for each angle can have
 * its own aspect ratio later without reflowing the layout.
 *
 * Everything positional is derived from `angles`, so a bag walks its five views
 * and a shoe walks its own five. The counter reads "1 / 5" either way, which is
 * why it asks the array for its length rather than hardcoding five.
 *
 * Keyboard: the arrows and the dots are real buttons, so this is operable
 * without a pointer at all.
 */
export function AngleSwiper({
  productName,
  color,
  angles,
  angleIndex,
  onAngleChange,
  className = "",
}: AngleSwiperProps) {
  const reduceMotion = useReducedMotion();

  const count = angles.length;
  const angle: Angle = angleAt(angleIndex, angles);
  const isFirst = isFirstIndex(angleIndex, count);
  const isLast = isLastIndex(angleIndex, count);

  return (
    <div className={className}>
      <motion.div
        /* The whole frame is the drag handle. */
        drag={reduceMotion ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        onDragEnd={(_, info) => {
          const { offset, velocity } = info;

          if (offset.x <= -SWIPE_DISTANCE || velocity.x <= -SWIPE_VELOCITY) {
            onAngleChange(stepIndex(angleIndex, 1, count));
          } else if (offset.x >= SWIPE_DISTANCE || velocity.x >= SWIPE_VELOCITY) {
            onAngleChange(stepIndex(angleIndex, -1, count));
          }
        }}
        /* Lift slightly under the finger, so the frame reads as a physical
           object being moved rather than a page scrolling. */
        whileDrag={reduceMotion ? undefined : { scale: 0.985 }}
        transition={{ type: "spring", duration: 0.35, bounce: 0 }}
        style={{ cursor: reduceMotion ? "default" : "grab" }}
        role="group"
        aria-roledescription="carousel"
        className="relative aspect-square w-full touch-pan-y overflow-hidden rounded-2xl bg-card select-none"
        aria-label={`${productName} in ${color.name}, ${angleSpoken(angle)} view`}
      >
        {/* Keyed on colour and angle so a change fades rather than swaps. The
            outgoing view leaves before the incoming one arrives. `initial={false}`
            keeps the first view from animating in on page load. */}
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            key={`${color.id}-${angle}`}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <ProductImage
              src={color.images[angle] ?? null}
              hex={color.hex}
              colorName={color.name}
              productName={productName}
              angle={angle}
              priority
            />
          </motion.div>
        </AnimatePresence>

        {/* Edge hints, so the drag is discoverable on a touch screen where there
            is no cursor to hover. */}
        {!isFirst ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/10 to-transparent"
          />
        ) : null}
        {!isLast ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/10 to-transparent"
          />
        ) : null}
      </motion.div>

      {/* Controls. Visible at every size — the drag is the fast path on a phone,
          the buttons are the reliable one. */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <AngleDots
          activeIndex={angleIndex}
          angles={angles}
          onSelect={onAngleChange}
          size="md"
          className="flex-1"
        />

        <div className="flex items-center gap-1.5">
          <SwipeButton
            onClick={() => onAngleChange(stepIndex(angleIndex, -1, count))}
            disabled={isFirst}
            label="Previous view"
          >
            <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
          </SwipeButton>

          <span className="min-w-16 text-center text-xs tabular-nums text-muted">
            {angleIndex + 1} / {count}
          </span>

          <SwipeButton
            onClick={() => onAngleChange(stepIndex(angleIndex, 1, count))}
            disabled={isLast}
            label="Next view"
          >
            <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
          </SwipeButton>
        </div>
      </div>
    </div>
  );
}

type SwipeButtonProps = {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
};

/** 44px touch target, quiet at rest, solid under the finger. */
function SwipeButton({ onClick, disabled, label, children }: SwipeButtonProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      whileTap={disabled || reduceMotion ? undefined : { scale: 0.92 }}
      transition={{ type: "spring", duration: 0.25, bounce: 0 }}
      className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors duration-150 ease-out hover:border-primary/40 hover:bg-primary/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </motion.button>
  );
}