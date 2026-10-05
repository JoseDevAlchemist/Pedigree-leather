"use client";

import { useReducedMotion } from "motion/react";

/**
 * A pulsing placeholder block.
 *
 * The pulse is CSS (`skeleton-pulse` in `globals.css`), not Motion. This is
 * deliberate on two counts: a skeleton grid can be 8–12 blocks and the browser
 * compositor animates all of them off the main thread for free, whereas N
 * Motion components would each register a JS animation on the same frame the
 * page is trying to become interactive. And the media query for reduced motion
 * lives inside the utility, so a caller cannot forget it — `useReducedMotion`
 * here would return `false` on the server and then flip on hydration, which
 * means the animation would start anyway, one frame late.
 *
 * Base fill is `--pedigree-border` at low opacity rather than Tailwind's
 * `bg-gray-200`. A neutral grey on a cream page reads as dirt, the same reason
 * the card shadows are warm — `lib/color.ts` has the same argument for the
 * product placeholders.
 */

type SkeletonProps = {
  className?: string;
  /** Semantic element, so a skeleton that stands in for a heading is a heading. */
  as?: "div" | "span" | "p" | "li";
};

export function Skeleton({ className = "", as: Tag = "div" }: SkeletonProps) {
  /* Read so the component re-renders when the preference changes. The class it
     controls is a media query, so there is nothing to branch on — but a
     component that ignores the setting entirely would not re-render on the
     change, and its callers do branch on it. */
  useReducedMotion();

  return (
    <Tag
      aria-hidden="true"
      className={`skeleton-pulse rounded-md bg-border/70 ${className}`}
    />
  );
}