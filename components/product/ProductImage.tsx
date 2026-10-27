"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useState } from "react";

import { angleLabel, angleSpoken } from "@/lib/angles";
import { onColorOpacity, readableTextClass, shade } from "@/lib/color";
import type { Angle } from "@/lib/types";

/**
 * `sizes` for an image inside the shop grid — a card in the two/four-up layout.
 *
 * At 1024px and up the grid is four columns inside `max-w-6xl`, so a card is
 * about 254px, roughly 22vw; the middle step covers the three-up tablet grid and
 * the final `50vw` is the two-up phone grid. This is a hint, not a measurement:
 * when it is too low the browser fetches a source smaller than the slot and the
 * photograph looks soft, which is the bug this constant exists to prevent.
 */
export const CARD_IMAGE_SIZES = "(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 50vw";

/**
 * `sizes` for the product detail page's main image.
 *
 * The detail image sits either full width (stacked, below `lg`) or in the wider
 * of two columns — roughly 48–54vw between 1024px and 1280px.
 *
 * Below `lg` the hint is deliberately smaller than the rendered width: a `100vw`
 * hint on a 3x phone asked for a 1440px source. `52vw` keeps the candidate under
 * the loader's 800px phone bucket at 1x, 2x and 3x, which is still sharp on a
 * phone without the desktop-sized download. Tablets get the larger 66vw step,
 * where there is room to spare.
 */
export const DETAIL_IMAGE_SIZES =
  "(min-width: 1024px) 50vw, (min-width: 768px) 66vw, 52vw";

/**
 * The quality every product photograph is optimised at.
 *
 * 75 is the size/quality point for this catalogue. The loader also requests the
 * square crop the layout actually displays, which keeps an 800px phone image
 * around 40–90 KB across the current catalogue. This value must also appear in
 * `images.qualities` in `next.config.ts` — Next 16 coerces an unlisted quality
 * back down without warning, so the two move together.
 */
const IMAGE_QUALITY = 75;

type ProductImageProps = {
  /** Image URL for this angle of this colour, or `null` while photography is pending. */
  src: string | null;
  /** The colour's hex. Doubles as the alt text source and the placeholder fill. */
  hex: string;
  /** Colour name, used in the alt text. */
  colorName: string;
  /** Product name, used in the alt text. */
  productName: string;
  angle: Angle;
  /** Sizing behaviour. `fill` fills the parent; `card` gives the card its square. */
  sizing?: "fill" | "square";
  /**
   * The `sizes` hint for the browser's srcset choice. Defaults to the shop
   * grid's card width; the product detail page passes `DETAIL_IMAGE_SIZES`.
   */
  sizes?: string;
  className?: string;
  /** Animate in on mount. Used by the angle swiper, not by grid cards. */
  animateIn?: boolean;
  priority?: boolean;
};

/**
 * One angle of one colour.
 *
 * Renders a real `<Image>` when photography exists, and otherwise a block of
 * the colour's own hex, treated as a leather swatch rather than a missing
 * image: a directional grain, a soft sheen, and the angle name stamped into it.
 * The stamp is what makes the five dots legible as "five views of this bag"
 * instead of an unexplained row of dots.
 *
 * When photography arrives the only change is that `src` stops being `null`.
 */
export function ProductImage({
  src,
  hex,
  colorName,
  productName,
  angle,
  sizing = "fill",
  sizes = CARD_IMAGE_SIZES,
  className = "",
  animateIn = false,
  priority = false,
}: ProductImageProps) {
  /* Alt text reads as a sentence, so it uses the spoken label ("left side")
   * rather than the stamped one ("Side L"). */
  const alt = `${productName} in ${colorName}, ${angleSpoken(angle)} view`;

  const frame = sizing === "square" ? "relative aspect-square w-full" : "relative size-full";

  if (src) {
    /* Keyed on the source so a changed URL — including a replacement upload's
       `?v=` cache-buster — remounts the photo and clears a previous error. */
    return (
      <ProductPhoto
        key={src}
        src={src}
        alt={alt}
        hex={hex}
        angle={angle}
        frame={frame}
        className={className}
        sizes={sizes}
        priority={priority}
        animateIn={animateIn}
      />
    );
  }

  return (
    <ProductPlaceholder
      alt={alt}
      hex={hex}
      angle={angle}
      frame={frame}
      className={className}
      animateIn={animateIn}
    />
  );
}

type ProductPhotoProps = {
  src: string;
  alt: string;
  hex: string;
  angle: Angle;
  frame: string;
  className: string;
  sizes: string;
  priority: boolean;
  animateIn: boolean;
};

/**
 * The real photograph, with a fallback for sources Supabase cannot transform.
 *
 * Supabase's image renderer rejects originals over 5 MB, and a CDN/proxy failure
 * produces the same `error` event. Falling back to the leather swatch keeps the
 * grid intact instead of leaving a broken-image icon and a blank 4:5 frame.
 */
function ProductPhoto({
  src,
  alt,
  hex,
  angle,
  frame,
  className,
  sizes,
  priority,
  animateIn,
}: ProductPhotoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <ProductPlaceholder
        alt={alt}
        hex={hex}
        angle={angle}
        frame={frame}
        className={className}
        animateIn={animateIn}
      />
    );
  }

  return (
    <div className={`${frame} overflow-hidden ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        quality={IMAGE_QUALITY}
        sizes={sizes}
        className="object-cover"
        style={{ boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.1)" }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

type ProductPlaceholderProps = {
  alt: string;
  hex: string;
  angle: Angle;
  frame: string;
  className: string;
  animateIn: boolean;
};

/**
 * The no-photograph state: a block of the colour's own hex, treated as a leather
 * swatch rather than a missing image. The three background layers are a fine
 * diagonal grain, a sheen in the top-left, and a top-to-bottom tone shift — all
 * derived from the colour itself, so cream reads as pale leather and black reads
 * as deep.
 */
function ProductPlaceholder({
  alt,
  hex,
  angle,
  frame,
  className,
  animateIn,
}: ProductPlaceholderProps) {
  const reduceMotion = useReducedMotion();
  const grain = onColorOpacity(hex, 0.06, 0.045);
  const sheen = onColorOpacity(hex, 0.16, 0.26);
  const labelClass = readableTextClass(hex);

  return (
    <motion.div
      className={`${frame} overflow-hidden ${className}`}
      initial={animateIn && !reduceMotion ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.24, ease: "easeOut" }}
      role="img"
      aria-label={alt}
      style={{
        backgroundColor: hex,
        backgroundImage: [
          `repeating-linear-gradient(115deg, rgb(255 255 255 / ${grain}) 0 2px, rgb(0 0 0 / ${grain}) 2px 3px, transparent 3px 6px)`,
          `radial-gradient(120% 95% at 24% 12%, rgb(255 255 255 / ${sheen}), transparent 62%)`,
          `linear-gradient(165deg, ${shade(hex, 0.1)}, ${shade(hex, -0.22)})`,
        ].join(", "),
        boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.08)",
      }}
    >
      {/* The stamp. Debossed rather than printed: a dark offset and a light
          counter-offset read as pressed-in, at any colour lightness. */}
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 bottom-4 flex justify-center font-serif text-[0.6875rem] font-medium tracking-[0.14em] uppercase ${labelClass}`}
        style={{
          textShadow:
            labelClass === "text-background"
              ? "0 1px 0 rgb(0 0 0 / 0.35)"
              : "0 -1px 0 rgb(255 255 255 / 0.4)",
          opacity: 0.72,
        }}
      >
        {angleLabel(angle)}
      </span>
    </motion.div>
  );
}