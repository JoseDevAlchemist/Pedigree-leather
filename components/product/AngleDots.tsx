"use client";

import { ANGLES, angleLabel } from "@/lib/angles";

type AngleDotsProps = {
  activeIndex: number;
  /** Supplied on the detail page, where a dot jumps to an angle. Omitted on the card, where the dots are a read-only indicator. */
  onSelect?: (index: number) => void;
  size?: "sm" | "md";
  /** Left-aligned on a card, centred under the swiper on the detail page. */
  align?: "start" | "center";
  className?: string;
};

/**
 * The five-angle position indicator.
 *
 * On a product card it is decoration: the dots just report which view is showing
 * and sit behind the card's link, so they are hidden from assistive tech. On the
 * detail page the same component becomes five real buttons.
 */
export function AngleDots({
  activeIndex,
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
      {ANGLES.map((angle, index) => {
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
            aria-label={`Show ${angleLabel(angle).toLowerCase()} view`}
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