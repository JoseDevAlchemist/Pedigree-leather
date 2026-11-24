"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useState } from "react";

import { angleSpoken } from "@/lib/angles";
import { onColorOpacity, readableTextClass, shade } from "@/lib/color";
import { originalProductImageUrl, productPhotoVariant } from "@/lib/product-image-url";
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
  loading?: "eager" | "lazy";
  fetchPriority?: "high";
  sizes?: string;
};

/** Show a stored photo or a colour sample while photography is pending. */
export function ProductImage({
  src,
  hex,
  colorName,
  productName,
  angle,
  sizing = "fill",
  className = "",
  animateIn = false,
  loading = "lazy",
  fetchPriority,
  sizes = "(min-width: 1024px) 560px, 100vw",
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
        src={originalProductImageUrl(src)}
        alt={alt}
        hex={hex}
        colorName={colorName}
        placeholderLabel={`${productName} in ${colorName}. Photo unavailable.`}
        frame={frame}
        className={className}
        loading={loading}
        fetchPriority={fetchPriority}
        sizes={sizes}
        animateIn={animateIn}
      />
    );
  }

  return (
    <ProductPlaceholder
      alt={`${productName} in ${colorName}. Photo unavailable.`}
      hex={hex}
      colorName={colorName}
      frame={frame}
      className={className}
      animateIn={animateIn}
    />
  );
}

type ProductPhotoProps = {
  src: string;
  alt: string;
  placeholderLabel: string;
  hex: string;
  colorName: string;
  frame: string;
  className: string;
  loading: "eager" | "lazy";
  fetchPriority?: "high";
  sizes: string;
  animateIn: boolean;
};

/** Fall back to the leather swatch when the stored photograph fails to load. */
function ProductPhoto({
  src,
  alt,
  placeholderLabel,
  hex,
  colorName,
  frame,
  className,
  loading,
  fetchPriority,
  sizes,
  animateIn,
}: ProductPhotoProps) {
  const [failed, setFailed] = useState(false);
  const [variantFailed, setVariantFailed] = useState(false);
  const variant = variantFailed ? null : productPhotoVariant(src);

  if (failed) {
    return (
      <ProductPlaceholder
        alt={placeholderLabel}
        hex={hex}
        colorName={colorName}
        frame={frame}
        className={className}
        animateIn={animateIn}
      />
    );
  }

  return (
    <div className={`${frame} overflow-hidden ${className}`}>
      <picture>
        {variant && (
          <source
            srcSet={`${variant.url} ${variant.cardWidth}w, ${src} ${variant.originalWidth}w`}
            sizes={sizes}
          />
        )}
        <Image
          src={src}
          alt={alt}
          fill
          loading={loading}
          fetchPriority={fetchPriority}
          className="object-cover"
          style={{ boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.1)" }}
          onError={(event) => {
            if (variant && event.currentTarget.currentSrc === variant.url) setVariantFailed(true);
            else setFailed(true);
          }}
        />
      </picture>
    </div>
  );
}

type ProductPlaceholderProps = {
  alt: string;
  hex: string;
  colorName: string;
  frame: string;
  className: string;
  animateIn: boolean;
};

function ProductPlaceholder({
  alt,
  hex,
  colorName,
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
      <div className="absolute inset-3 rounded-[inherit] border border-current opacity-15" aria-hidden="true" />
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 bottom-6 px-5 text-center font-serif text-lg font-semibold sm:text-xl ${labelClass}`}
      >
        {colorName}
      </span>
    </motion.div>
  );
}