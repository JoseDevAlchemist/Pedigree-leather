"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/** How long each view is held during the in-view roll. Five views ≈ 2.5s. */
const STEP_MS = 500;
/** Extra hold on the last view before it settles back to the front. */
const SETTLE_MS = 900;
/** Fraction of the card that must be on screen before the roll plays. */
const VISIBILITY_THRESHOLD = 0.5;

/**
 * The mobile image roll.
 *
 * A phone has no hover, so the desktop roll has no trigger — but a static grid
 * of identically-stamped leather blocks does not tell a shopper there is
 * anything behind the picture. This is the substitute: a card that scrolls into
 * view plays its views once, then settles back to the front.
 *
 * Rules:
 * - Fires when the card is at least half on screen. Half, rather than any
 *   sliver, so a card glimpsed at the edge of a fast flick does not start
 *   animating behind the shopper's thumb.
 * - Holds each view for `STEP_MS`, plays in roll order from the front, holds the
 *   last one, then returns to the front.
 * - Re-arms after the card leaves the viewport, so scrolling back up replays it.
 *   A shopper scrolling back up is looking at that card again, which is the only
 *   cue that would tell them there is more than one view.
 * - Reduced motion: no roll at all. Every view is still reachable — the detail
 *   page has arrows and dots for all of them.
 * - Desktop: a no-op, because `useHasHover()` is false and the hover roll owns
 *   the pointer instead. Both hooks run unconditionally so the rules of hooks
 *   hold; this one simply does nothing.
 */
export function useInViewAutoRoll({
  angleCount,
  enabled,
  targetRef,
  stepMs = STEP_MS,
}: {
  /** How many views this product has. */
  angleCount: number;
  /** False on desktop, and when motion is reduced. */
  enabled: boolean;
  /** The card to observe. A ref rather than a callback, so it is populated by
   *  the time this effect runs and never fires with a detached node. */
  targetRef: React.RefObject<HTMLElement | null>;
  stepMs?: number;
}) {
  const reduceMotion = useReducedMotion();
  const active = enabled && !reduceMotion;

  const [currentAngleIndex, setCurrentAngleIndex] = useState(0);

  useEffect(() => {
    const element = targetRef.current;
    if (!element || !active || angleCount <= 1) return;

    /* One timeout per scheduled frame, cleared together. Using an array rather
       than a single rescheduling timer keeps the whole sequence cancellable in
       one place, which matters because the observer can fire again at any moment. */
    let timers: ReturnType<typeof setTimeout>[] = [];

    const clearTimers = () => {
      timers.forEach(clearTimeout);
      timers = [];
    };

    const play = () => {
      clearTimers();
      setCurrentAngleIndex(0);

      /* Views 1..n-1, then a settle on the last, then back to the front. */
      for (let index = 1; index < angleCount; index += 1) {
        timers.push(setTimeout(() => setCurrentAngleIndex(index), stepMs * index));
      }
      timers.push(
        setTimeout(() => setCurrentAngleIndex(angleCount - 1), stepMs * angleCount),
      );
      timers.push(
        setTimeout(() => setCurrentAngleIndex(0), stepMs * angleCount + SETTLE_MS),
      );
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) play();
        else clearTimers();
      },
      { threshold: VISIBILITY_THRESHOLD },
    );

    observer.observe(element);
    return () => {
      clearTimers();
      observer.disconnect();
    };
  }, [active, angleCount, stepMs, targetRef]);

  return { currentAngleIndex };
}