/**
 * Class name helpers to avoid TypeScript parser issues with `/` in Tailwind class names.
 * The parser interprets `/` in template literals as a regex literal.
 * Use these helpers to build class names with opacity modifiers safely.
 * Uses Tailwind's separate opacity utilities (e.g., `bg-opacity-10`) instead of `/` syntax.
 */

export function bgOpacity(opacity: number): string {
  return `bg-opacity-${opacity}`;
}

export function textOpacity(opacity: number): string {
  return `text-opacity-${opacity}`;
}

export function borderOpacity(opacity: number): string {
  return `border-opacity-${opacity}`;
}

export function ringOpacity(opacity: number): string {
  return `ring-opacity-${opacity}`;
}

export function placeholderOpacity(opacity: number): string {
  return `placeholder-opacity-${opacity}`;
}

/* Pre-built common combinations using Tailwind's opacity utilities */
export const CLASSES = {
  primary: {
    bg: "bg-primary",
    bg10: "bg-primary bg-opacity-10",
    bg5: "bg-primary bg-opacity-5",
    text: "text-primary",
    border: "border-primary",
    border10: "border-primary border-opacity-10",
    border30: "border-primary border-opacity-30",
    ring: "ring-primary",
    ring20: "ring-primary ring-opacity-20",
    ring40: "ring-primary ring-opacity-40",
    hoverBg: "hover:bg-primary-deep",
    focusRing: "focus-visible:ring-primary focus-visible:ring-opacity-40",
  },
  emerald: {
    bg: "bg-emerald-500",
    bg10: "bg-emerald-500 bg-opacity-10",
    text: "text-emerald-500",
    text600: "text-emerald-600",
    text700: "text-emerald-700",
    border: "border-emerald-500",
    hoverBg: "hover:bg-emerald-600",
  },
  rose: {
    bg: "bg-rose-500",
    bg50: "bg-rose-500 bg-opacity-50",
    bg100: "bg-rose-100",
    text: "text-rose-600",
    text700: "text-rose-700",
    border: "border-rose-300",
    border50: "border-rose-300 border-opacity-50",
    hoverBg: "hover:bg-rose-50",
    hoverBg500: "hover:bg-rose-500",
    hoverBg700: "hover:bg-rose-700",
    text600: "text-rose-600",
  },
  amber: {
    bg: "bg-amber-100",
    bg50: "bg-amber-500 bg-opacity-50",
    text: "text-amber-700",
    border: "border-amber-300",
    hoverBg: "hover:bg-amber-50",
  },
  muted: {
    bg: "bg-muted",
    bg50: "bg-muted bg-opacity-50",
    text: "text-muted",
    text50: "text-muted text-opacity-50",
    border: "border-muted",
  },
  accent: {
    bg: "bg-accent",
    bg10: "bg-accent bg-opacity-10",
    text: "text-accent",
    border: "border-accent",
    hoverBg: "hover:bg-accent",
    hoverBrightness: "hover:brightness-95",
  },
  destructive: {
    bg10: "bg-destructive bg-opacity-10",
    text: "text-destructive",
    border10: "border-destructive border-opacity-10",
  },
  whatsapp: {
    bg: "bg-whatsapp",
    hoverBrightness: "hover:brightness-95",
  },
  charcoal: {
    bg: "bg-charcoal",
  },
  background: {
    bg: "bg-background",
    bg5: "bg-background bg-opacity-5",
  },
  border: {
    base: "border-border",
    border10: "border-border border-opacity-10",
    border30: "border-border border-opacity-30",
  },
  card: {
    bg: "bg-card",
  },
  primaryDeep: {
    hoverBg: "hover:bg-primary-deep",
  },
  background5: {
    bg5: "bg-background bg-opacity-5",
  },
  background10: {
    bg10: "bg-background bg-opacity-10",
  },
  background50: {
    bg50: "bg-background bg-opacity-50",
  },
  primary10: {
    bg10: "bg-primary bg-opacity-10",
  },
  primary20: {
    ring20: "ring-primary ring-opacity-20",
  },
  primary40: {
    ring40: "ring-primary ring-opacity-40",
    focusRing40: "focus-visible:ring-primary focus-visible:ring-opacity-40",
  },
  primary5: {
    bg5: "bg-primary bg-opacity-5",
  },
  muted50: {
    text50: "text-muted text-opacity-50",
    bg50: "bg-muted bg-opacity-50",
  },
  rose50: {
    bg50: "bg-rose-500 bg-opacity-50",
    border50: "border-rose-300 border-opacity-50",
    hoverBg50: "hover:bg-rose-50",
  },
  amber10: {
    bg10: "bg-amber-500 bg-opacity-10",
  },
  emerald500: {
    bg: "bg-emerald-500",
    text: "text-emerald-500",
    text600: "text-emerald-600",
    text700: "text-emerald-700",
    hoverBg: "hover:bg-emerald-600",
  },
  primaryBg10: {
    bg10: "bg-primary bg-opacity-10",
    ring20: "ring-primary ring-opacity-20",
    ring40: "ring-primary ring-opacity-40",
    focusRing40: "focus-visible:ring-primary focus-visible:ring-opacity-40",
  },
  primaryBg5: {
    bg5: "bg-primary bg-opacity-5",
  },
  primaryDeepHover: {
    hoverBg: "hover:bg-primary-deep",
  },
  accent10: {
    bg10: "bg-accent bg-opacity-10",
    hoverBrightness: "hover:brightness-95",
  },
  destructive10: {
    bg10: "bg-destructive bg-opacity-10",
    text: "text-destructive",
    border10: "border-destructive border-opacity-10",
  },
  whatsappHover: {
    hoverBrightness: "hover:brightness-95",
  },
  charcoalBg: {
    bg: "bg-charcoal",
  },
};

/* Color palette for status badges */
export const STATUS_COLORS = {
  pending_payment: "amber",
  paid: "emerald",
  preparing: "blue",
  ready_for_delivery: "indigo",
  out_for_delivery: "violet",
  delivered: "emerald",
  cancelled: "rose",
} as const;

export type StatusKey = keyof typeof STATUS_COLORS;

export function getStatusColorClass(
  status: string,
  variant: "bg" | "text" | "border" | "bg10" | "text600" | "text700" | "hoverBg" | "border50" | "hoverBg50" | "hoverBg500" | "hoverBg700" = "text"
): string {
  const color = STATUS_COLORS[status as StatusKey] || "muted";

  if (variant === "text" || variant === "text600" || variant === "text700") {
    const shade = variant === "text" ? "500" : variant === "text600" ? "600" : "700";
    return `text-${color}-${shade}`;
  }
  if (variant === "bg" || variant === "bg10") {
    const opacity = variant === "bg" ? "" : " bg-opacity-10";
    return `bg-${color}-500${opacity}`;
  }
  if (variant === "border" || variant === "border50") {
    const opacity = variant === "border" ? " border-opacity-300" : " border-opacity-50";
    return `border-${color}-300${opacity}`;
  }
  if (variant === "hoverBg" || variant === "hoverBg50" || variant === "hoverBg500" || variant === "hoverBg700") {
    const shade = variant === "hoverBg" ? "100" : variant === "hoverBg50" ? "50" : variant === "hoverBg500" ? "500" : "700";
    return `hover:bg-${color}-${shade}`;
  }
  return `text-${color}-500`;
}