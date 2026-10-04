"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";

import { angleLabel } from "@/lib/angles";
import { onColorOpacity, readableTextClass, shade } from "@/lib/color";
import type { Angle } from "@/lib/types";

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
  className = "",
  animateIn = false,
  priority = false,
}: ProductImageProps) {
  const reduceMotion = useReducedMotion();

  const alt = `${productName} in ${colorName}, ${angleLabel(angle).toLowerCase()} view`;

  const frame = sizing === "square" ? "relative aspect-square w-full" : "relative size-full";

  if (src) {
    return (
      <div className={`${frame} overflow-hidden ${className}`}>
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="(min-width: 1280px) 22rem, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
          className="object-cover"
          style={{ boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.1)" }}
        />
      </div>
    );
  }

  /* Placeholder. The three background layers are: a fine diagonal grain, a
     sheen in the top-left, and a top-to-bottom tone shift — all derived from the
     colour itself, so cream reads as pale leather and black reads as deep. */
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