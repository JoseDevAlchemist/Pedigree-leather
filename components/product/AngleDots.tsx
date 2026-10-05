"use client";

import { angleSpoken } from "@/lib/angles";
import type { Angle } from "@/lib/types";

type AngleDotsProps = {
  activeIndex: number;
  /** This product's views, in roll order. One dot per entry. */
  angles: readonly Angle[];
  /** Supplied on the detail page, where a dot jumps to an angle. Omitted on the card, where the dots are a read-only indicator. */
  onSelect?: (index: number) => void;
  size?: "sm" | "md";
  /** Left-aligned on a card, centred under the swiper on the detail page. */
  align?: "start" | "center";
  className?: string;
};

/**
 * The position indicator for a product's views.
 *
 * One dot per `Product.angles` entry, so a bag shows five and a shoe shows five
 * different ones — a shoe never gets a "top of the gusset" dot it was not
 * photographed from.
 *
 * On a product card it is decoration: the dots just report which view is showing
 * and sit behind the card's link, so they are hidden from assistive tech. On the
 * detail page the same component becomes real buttons.
 */
export function AngleDots({
  activeIndex,
  angles,
  onSelect,
  size = "sm",
  align = "center",
  className = "",
}: AngleDotsProps) {
  const interactive = typeof onSelect === "function";
  const dotSize = size === "sm" ? "size-1.5" : "size-2";

  return (
    <div
      className={`flex items-center gap-1.5 ${
        align === "start" ? "justify-start" : "justify-center"
      } ${className}`}
      {...(interactive
        ? { role: "group", "aria-label": "Choose a view" }
        : { "aria-hidden": "true" })}
    >
      {angles.map((angle, index) => {
        const isActive = index === activeIndex;
        const dot = (
          <span
            className={`${dotSize} rounded-full transition-colors duration-200 ease-out ${
              isActive ? "bg-primary" : "bg-muted/40"
            }`}
          />
        );

        if (!interactive) return <span key={angle}>{dot}</span>;

        return (
          <button
            key={angle}
            type="button"
            onClick={() => onSelect(index)}
            aria-label={`Show ${angleSpoken(angle)} view`}
            aria-current={isActive ? "true" : undefined}
            /* The dot is small; the hit area is not. */
            className="-m-2 flex size-8 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          >
            {dot}
          </button>
        );
      })}
    </div>
  );
}