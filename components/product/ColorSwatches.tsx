"use client";

import { motion, useReducedMotion } from "motion/react";

import type { ColorVariant } from "@/lib/types";

type ColorSwatchesProps = {
  colors: ColorVariant[];
  activeColorId: string;
  onSelect: (colorId: string) => void;
  /**
   * `sm` on a card, `lg` on the detail page (where hovering reveals the name).
   * `sm` is responsive: the dot is 16px on a phone, where two cards share a
   * 375px row, and 20px from `sm` up. The hit area stays 32px either way —
   * below that it fails WCAG's 24px minimum, and the button is what a phone
   * shopper is aiming at.
   */
  size?: "sm" | "lg";
  /** Sold-out products cannot be re-coloured. */
  disabled?: boolean;
  /** The detail page names the active colour in text as well as on hover. */
  showActiveName?: boolean;
  className?: string;
};

/**
 * Colourway picker.
 *
 * A radio group, because exactly one colour is active at a time and arrow keys
 * should walk the group. The swatch fill is the only dynamic colour in the whole
 * card — everything around it is a token class.
 */
export function ColorSwatches({
  colors,
  activeColorId,
  onSelect,
  size = "sm",
  disabled = false,
  showActiveName = false,
  className = "",
}: ColorSwatchesProps) {
  const reduceMotion = useReducedMotion();

  const dot = size === "sm" ? "size-4 sm:size-5" : "size-8";
  const hit = size === "sm" ? "size-8" : "size-11";

  const activeColor = colors.find((color) => color.id === activeColorId);

  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${disabled ? "pointer-events-none opacity-50" : ""} ${className}`}
      role="radiogroup"
      aria-label="Colour"
    >
      {colors.map((color) => {
        const isActive = color.id === activeColorId;

        return (
          <motion.button
            key={color.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={color.name}
            title={size === "lg" ? color.name : undefined}
            disabled={disabled}
            onClick={() => onSelect(color.id)}
            /* Selection is instant (colour change), but the press is a spring.
               No bouncy overshoot here: a colour chip that wobbles looks loose. */
            whileTap={reduceMotion ? undefined : { scale: 0.9 }}
            transition={{ type: "spring", duration: 0.25, bounce: 0 }}
            className={`flex ${hit} shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed`}
          >
            <span
              className={`${dot} rounded-full`}
              style={{
                backgroundColor: color.hex,
                /* Ring on the active swatch, plus a hairline on every swatch so
                   black-on-black and cream-on-cream still have an edge. */
                boxShadow: isActive
                  ? `0 0 0 2px var(--pedigree-cream), 0 0 0 4px var(--pedigree-gold)`
                  : "inset 0 0 0 1px rgb(0 0 0 / 0.12)",
              }}
            />
          </motion.button>
        );
      })}

      {/* The active colour's name, on the page rather than on the swatch — so a
          plain muted token is correct here. Rendered on every detail-page view
          so the colour is never hover-only information. */}
      {showActiveName && activeColor ? (
        <motion.span
          key={activeColor.id}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
          className="ml-2 text-sm text-muted"
        >
          {activeColor.name}
        </motion.span>
      ) : null}
    </div>
  );
}