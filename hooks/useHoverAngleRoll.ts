"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { nextIndex } from "@/lib/angles";
import type { Angle } from "@/lib/types";

/**
 * How long a crossfade between two views takes while browsing. Exported so a
 * card that changes view by some other means (its keyboard arrows) fades at the
 * same speed.
 */
export const CROSSFADE_MS = 150;
/* How long the return to the front view takes when the pointer leaves. Slower
   than a browse step on purpose: the pointer is gone, so nothing is competing
   for attention and a quicker fade reads as a flicker. */
const RESET_FADE_MS = 250;
/* How long the pointer must be still before the timed roll takes over again.
   Long enough that a shopper comparing two views by pointing does not get the
   picture yanked out from under them, short enough that it still feels alive
   when they leave the mouse parked. */
const RESUME_IDLE_MS = 600;
/* Pointer movements smaller than this are ignored. A cursor resting near a zone
   boundary emits sub-pixel jitter, and without a dead band the card would
   flicker between two views forever while nobody moved the mouse at all. */
const DEAD_ZONE_PX = 4;
/** Thirds. The zones are named for views, so this is a partition, not a scale. */
const THIRD = 1 / 3;

/**
 * Which view the cursor is pointing at.
 *
 * The partition is an "H": the outer thirds left and right belong to the sides
 * whatever the height, and the middle column is split into top, centre and
 * bottom. Horizontal is tested first, which is what makes a left-to-right sweep
 * feel continuous — the sides are the views people actually reach for, and they
 * get one uninterrupted band each.
 *
 * The corner regions resolve to the side rather than the top, so pointing at the
 * top-left of a bag shows its left flank, not the gusset.
 *
 * Zones name a *view*, not an index. A bag has `side-left` and `side-right`; a
 * shoe has one `side`. So each zone carries a fallback chain and the first angle
 * the product actually has wins:
 *
 * | zone          | prefers      | then    | then   |
 * |---------------|--------------|---------|--------|
 * | left third    | `side-left`  | `side`  | front  |
 * | right third   | `side-right` | `side`  | front  |
 * | top third     | `top`        | `laces` | front  |
 * | bottom third  | `bottom`     | `back`  | front  |
 * | centre        | `front`      | —       | first  |
 *
 * That single table is why a shoe pointing at its bottom edge shows the sole
 * (`bottom`, which it has) while a bag pointing at its bottom edge shows the
 * back panel (`back`, the closest thing a bag has) — the same gesture, resolved
 * against each product's own angles. A shoe pointing at its top edge shows the
 * lacing, because there is no top-down gusset shot of a shoe.
 *
 * Pure, and exported for tuning. It takes the angle list rather than a count,
 * because a count cannot say *which* views exist.
 */
export function getAngleFromMousePosition(
  x: number,
  y: number,
  angles: readonly Angle[],
): number {
  if (angles.length === 0) return 0;

  const chain: Angle[] =
    x < THIRD
      ? ["side-left", "side", "front"]
      : x > 1 - THIRD
        ? ["side-right", "side", "front"]
        : y < THIRD
          ? ["top", "laces", "front"]
          : y > 1 - THIRD
            ? ["bottom", "back", "front"]
            : ["front"];

  for (const angle of chain) {
    /* -1 means "this product does not have that view"; keep walking the chain. */
    const index = angles.indexOf(angle);
    if (index !== -1) return index;
  }

  return 0;
}

/**
 * The box the zones are measured against: the picture when there is one, else the
 * element the event fired on.
 *
 * Module scope on purpose. Reading `ref.current` inside a `useCallback` is legal
 * but it defeats the React Compiler's memoisation — it cannot prove the callback
 * is stable when the thing it closes over is mutable, and it gives up and skips
 * the optimisation for the whole hook. Handed the element instead, from the
 * handler that is allowed to read the ref, this stays a plain pure function.
 */
function surfaceRect(
  surface: HTMLElement | null | undefined,
  fallback: HTMLElement,
): DOMRect {
  if (surface) {
    const rect = surface.getBoundingClientRect();
    /* A collapsed surface divides by zero, every fraction becomes NaN, and the
       cascade quietly falls through to the front view — which reads as the roll
       not working at all. Fall back rather than divide. */
    if (rect.width > 0 && rect.height > 0) return rect;
  }
  return fallback.getBoundingClientRect();
}

type UseHoverAngleRollOptions = {
  /** How many views this product has. */
  angleCount: number;
  /**
   * `timed` — hover rolls forward on a timer and the cursor is ignored.
   * `hybrid` — the cursor drives which view shows, and the timer takes over once
   * the pointer has been still for a moment.
   */
  mode?: "timed" | "hybrid";
  /** Milliseconds per step in the timed roll. */
  intervalMs?: number;
  /** This product's views, needed to resolve a cursor position to a view. */
  angles: readonly Angle[];
  /**
   * The box the zones are measured against — the picture, not the card.
   *
   * This matters and is not a detail. A product card is taller than its image:
   * the square picture is roughly the top two thirds, and the name, price and
   * swatches sit below it. Measuring the cursor against the card meant a shopper
   * pointing at the bottom of the picture was only 60% of the way down the card,
   * landed in the middle band, and got the front view. Measuring against the
   * card's own event target gets every vertical zone wrong; measuring against
   * the image gets them right.
   *
   * Falls back to the event target when absent, so the hook still works for a
   * surface that is its own hover target.
   */
  surfaceRef?: React.RefObject<HTMLElement | null> | null;
};

type UseHoverAngleRollResult = {
  currentAngleIndex: number;
  isHovering: boolean;
  /** Crossfade length for the current change — slower on the reset to front. */
  fadeMs: number;
  handlers: {
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => void;
    onMouseLeave: () => void;
    onMouseMove: (event: React.MouseEvent<HTMLElement>) => void;
  };
};

/**
 * Desktop image roll.
 *
 * Trigger — the pointer entering the card. Rules — see `getAngleFromMousePosition`
 * for hybrid, and a plain looping timer for timed. Feedback — the image
 * crossfades and the dots move with it, so the roll is legible rather than a
 * slideshow nobody can follow. Loops — hybrid pauses while the pointer moves
 * and hands back to the timer after `RESUME_IDLE_MS` still; leaving stops
 * everything and returns to the front view.
 *
 * Reduced motion gets no roll at all, not a faster one. There is no non-moving
 * version of "the picture changes while you read", so the honest answer is to
 * keep showing the front view and let the shopper use the arrows or the dots.
 *
 * The view and its fade length live in one state object rather than as two
 * states plus an effect that reconciled them. Two states plus an effect means a
 * render where the index has reset but the fade is still the browse speed, and
 * it means a cascading setState on every hover.
 */
export function useHoverAngleRoll({
  angleCount,
  mode = "timed",
  intervalMs = 800,
  angles,
  surfaceRef = null,
}: UseHoverAngleRollOptions): UseHoverAngleRollResult {
  const reduceMotion = useReducedMotion();

  const [view, setView] = useState({ index: 0, fadeMs: CROSSFADE_MS });
  const [isHovering, setIsHovering] = useState(false);

  /* Timers and the last pointer position are genuinely mutable: written from
     event handlers and from timer callbacks, never read during render. That is
     what refs are for, and it is why these three are refs while the view itself
     is plain state.

     Note there is deliberately no `useCallback` anywhere in this hook. The React
     Compiler is enabled, it memoises these on its own, and a hand-written one
     that reads `ref.current` inside it defeats the optimisation — the compiler
     cannot prove such a callback is stable, so it skips compiling the hook
     entirely and reports "existing memoization could not be preserved". Letting
     it do the work is both faster and honest. */
  const rollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  /* Clears both timers. Every path that wants to stop the roll comes through
     here, so there is one place that can leak a timer and one place to look. */
  const stopRoll = () => {
    if (rollTimer.current !== null) {
      clearInterval(rollTimer.current);
      rollTimer.current = null;
    }
    if (idleTimer.current !== null) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  };

  /* Every change of view funnels through here, so there is exactly one place
     that decides what "show another view" means. Bails when nothing changed,
     which is what stops a mouse resting inside one zone from re-rendering the
     card sixty times a second. */
  const showAngle = (index: number, fadeMs = CROSSFADE_MS) => {
    setView((current) =>
      current.index === index && current.fadeMs === fadeMs ? current : { index, fadeMs },
    );
  };

  const startRoll = () => {
    if (rollTimer.current !== null) clearInterval(rollTimer.current);
    rollTimer.current = setInterval(() => {
      setView((current) => ({
        index: nextIndex(current.index, angleCount),
        fadeMs: CROSSFADE_MS,
      }));
    }, intervalMs);
  };

  /* Unmount cleanup. Reads the refs directly and takes no dependencies, because
     depending on `stopRoll` would mean re-running this effect on every render
     and cancelling a running roll every time. */
  useEffect(() => stopRoll, []);

  function onMouseEnter(event: React.MouseEvent<HTMLElement>) {
    if (reduceMotion) return;

    setIsHovering(true);
    lastPoint.current = null;

    if (mode === "timed") {
      startRoll();
      return;
    }

    /* Hybrid starts on the view under the cursor rather than on a timer, so the
       first thing a shopper sees is the part they are pointing at. */
    const rect = surfaceRect(surfaceRef?.current, event.currentTarget);
    if (rect.width === 0 || rect.height === 0) return;

    const index = getAngleFromMousePosition(
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
      angles,
    );
    if (index !== 0) showAngle(index);
  }

  function onMouseMove(event: React.MouseEvent<HTMLElement>) {
    /* No `isHovering` guard. `onMouseEnter` and `onMouseMove` are dispatched from
       the same native event, so React has not re-rendered between them and a
       guard reading that state would still see `false`, making the very first
       move of a hover a no-op. The handler is on the hover target, so it cannot
       fire while the pointer is elsewhere anyway. */
    if (reduceMotion || mode !== "hybrid") return;

    const { clientX, clientY } = event;

    /* Dead band. Measured in screen pixels, not fractions, so it behaves the same
       on a phone-sized card and a wide desktop one. */
    const last = lastPoint.current;
    if (
      last &&
      Math.abs(clientX - last.x) < DEAD_ZONE_PX &&
      Math.abs(clientY - last.y) < DEAD_ZONE_PX
    ) {
      return;
    }
    lastPoint.current = { x: clientX, y: clientY };

    /* A move pauses the timer and takes control of the view. */
    if (rollTimer.current !== null) {
      clearInterval(rollTimer.current);
      rollTimer.current = null;
    }

    const rect = surfaceRect(surfaceRef?.current, event.currentTarget);
    if (rect.width === 0 || rect.height === 0) return;

    showAngle(
      getAngleFromMousePosition(
        (clientX - rect.left) / rect.width,
        (clientY - rect.top) / rect.height,
        angles,
      ),
    );

    /* Hand control back once the pointer has settled. Re-armed on every move, so
       only the last move in a gesture decides when the roll returns. */
    if (idleTimer.current !== null) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      idleTimer.current = null;
      startRoll();
    }, RESUME_IDLE_MS);
  }

  function onMouseLeave() {
    stopRoll();
    lastPoint.current = null;
    setIsHovering(false);

    if (reduceMotion) return;

    /* Reset to the front view, slowly — see RESET_FADE_MS. */
    showAngle(0, RESET_FADE_MS);
  }

  return {
    /* Clamped on the way out rather than corrected by an effect on the way in: no
       stale index can address a view this product does not have, and nothing has
       to cascade a render to prove it. */
    currentAngleIndex: reduceMotion ? 0 : Math.min(view.index, Math.max(0, angleCount - 1)),
    isHovering,
    fadeMs: view.fadeMs,
    handlers: { onMouseEnter, onMouseLeave, onMouseMove },
  };
}
