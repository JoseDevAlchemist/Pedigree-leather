import type { Angle } from "@/lib/types";

/** Angle order. The index in this array is what the dots, arrows and swipe all address. */
export const ANGLES: readonly Angle[] = [
  "front",
  "side-left",
  "side-right",
  "top",
  "back",
] as const;

/** Human-readable names, shown stamped on the placeholder and read out to screen readers. */
export const ANGLE_LABELS: Record<Angle, string> = {
  front: "Front",
  "side-left": "Side left",
  "side-right": "Side right",
  top: "Top",
  back: "Back",
};

export function angleAt(index: number): Angle {
  return ANGLES[index] ?? ANGLES[0];
}

export function angleLabel(angle: Angle): string {
  return ANGLE_LABELS[angle];
}

/** Clamp any integer into the valid angle range, so arrows stop at the ends. */
export function normaliseIndex(index: number): number {
  if (Number.isNaN(index)) return 0;
  return Math.min(ANGLES.length - 1, Math.max(0, Math.round(index)));
}

/** Step through angles, stopping at either end rather than wrapping. */
export function stepIndex(index: number, delta: number): number {
  return normaliseIndex(index + delta);
}

export function isFirstIndex(index: number): boolean {
  return normaliseIndex(index) === 0;
}

export function isLastIndex(index: number): boolean {
  return normaliseIndex(index) === ANGLES.length - 1;
}