/**
 * Small colour maths for the placeholder blocks.
 *
 * Real product photography will remove most of this, but the placeholders are
 * currently every shopper's first impression of the grid, so they get treated
 * like a material rather than a flat fill.
 *
 * No hex values live here — these read the hex that came from the product data
 * and derive from it. Nothing in this file emits a raw hex into a className;
 * `readableTextClass` returns semantic tokens instead.
 */

/** Parse `#RGB`, `#RRGGBB` or `#RRGGBBAA`. Returns null for anything else. */
export function parseHex(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace(/^#/, "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((char) => char + char)
          .join("")
      : raw;

  if (full.length !== 6 || !/^[0-9a-f]{6}$/i.test(full)) return null;

  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

/**
 * Blend a colour toward white (positive `amount`) or black (negative).
 * `amount` runs from -1 to 1 and is applied per channel.
 */
export function shade(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;

  const target = amount >= 0 ? 255 : 0;
  const strength = Math.min(1, Math.abs(amount));

  const blended = rgb.map((channel) =>
    clampChannel(channel + (target - channel) * strength),
  );

  return `#${blended.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** Perceived brightness, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0.5;

  // Rec. 709 luma, then gamma-corrected toward perceptual lightness.
  const luma = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;

  return luma <= 0.03928
    ? luma / 12.92
    : Math.pow((luma + 0.055) / 1.055, 2.4);
}

/**
 * The token class that stays legible on top of this colour.
 *
 * The grid has to hold cream (`#EFE3D2`) and black (`#1C1C1C`) swatches side by
 * side, so "always white text" would fail on the light ones.
 */
export function readableTextClass(hex: string): "text-background" | "text-foreground" {
  return luminance(hex) > 0.45 ? "text-foreground" : "text-background";
}

/** Opacity for the debossed label and the grain, tuned per background lightness. */
export function onColorOpacity(hex: string, dark: number, light: number): number {
  return luminance(hex) > 0.45 ? light : dark;
}