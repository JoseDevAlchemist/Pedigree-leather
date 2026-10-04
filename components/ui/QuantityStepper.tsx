"use client";

import { Minus, Plus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

type QuantityStepperProps = {
  value: number;
  /** Passed straight to `onChange`. */
  onChange: (next: number) => void;
  min?: number;
  /** Ceiling for this product — either the stock on hand or the per-line cap. */
  max: number;
  size?: "sm" | "md";
  label?: string;
  disabled?: boolean;
};

const SIZES = {
  sm: { wrap: "h-9", button: "size-9", icon: 14, text: "w-7 text-sm" },
  md: { wrap: "h-12", button: "size-12", icon: 16, text: "w-9 text-base" },
} as const;

/**
 * Quantity picker.
 *
 * The buttons are disabled at the ends rather than wrapping or clamping
 * silently, so the ceiling is always visible rather than discovered.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  size = "md",
  label = "Quantity",
  disabled = false,
}: QuantityStepperProps) {
  const dims = SIZES[size];

  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && value < max;

  return (
    <div
      className={`inline-flex ${dims.wrap} items-center rounded-full border border-border bg-card`}
      role="group"
      aria-label={label}
    >
      <StepperButton
        onClick={() => onChange(value - 1)}
        disabled={!canDecrease}
        label={`Decrease ${label.toLowerCase()}`}
        className={dims.button}
      >
        <Minus size={dims.icon} strokeWidth={2} aria-hidden="true" />
      </StepperButton>

      {/* tabular-nums: the digits must not shift the buttons when the number changes. */}
      <span
        aria-live="polite"
        aria-atomic="true"
        className={`${dims.text} text-center font-semibold tabular-nums text-foreground`}
      >
        <span className="sr-only">{`${label}: `}</span>
        {value}
      </span>

      <StepperButton
        onClick={() => onChange(value + 1)}
        disabled={!canIncrease}
        label={`Increase ${label.toLowerCase()}`}
        className={dims.button}
      >
        <Plus size={dims.icon} strokeWidth={2} aria-hidden="true" />
      </StepperButton>
    </div>
  );
}

type StepperButtonProps = {
  onClick: () => void;
  disabled: boolean;
  label: string;
  className?: string;
  children: React.ReactNode;
};

function StepperButton({
  onClick,
  disabled,
  label,
  className = "",
  children,
}: StepperButtonProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      whileTap={disabled || reduceMotion ? undefined : { scale: 0.92 }}
      transition={{ type: "spring", duration: 0.25, bounce: 0 }}
      className={`flex ${className} shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors duration-150 ease-out hover:bg-primary/8 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-30`}
    >
      {children}
    </motion.button>
  );
}