"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * A modal that asks before doing something irreversible.
 *
 * Reusable rather than written inline at each call site, because the three things
 * that make a confirm dialog usable are the three that get forgotten when it is
 * copy-pasted into a new place:
 *
 *   1. **Focus goes in, and comes back.** Focus moves to the cancel button — not the
 *      destructive one — so a stray Enter cannot delete something. On close, focus
 *      returns to whatever opened it, so a keyboard user is not dropped at the top of
 *      the document.
 *   2. **Tab stays inside.** `document` listener rather than `tabIndex` juggling, so
 *      shift-tab from the first control lands on the last.
 *   3. **Escape and the backdrop both close.** And Escape is the *fast* path, which
 *      is why it needs no confirmation of its own — it is the way out.
 *
 * Rendered through a portal to `document.body`. Without that it would be trapped
 * inside whatever ancestor clips or transforms it — a table row with `overflow-x:
 * auto` is exactly the kind of ancestor that clips a fixed-position overlay.
 */

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  /** Shown in the body, for naming what is about to go. */
  subject?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Set while the action runs, so the dialog cannot be confirmed twice. */
  isPending?: boolean;
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  subject,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  isPending = false,
}: ConfirmDialogProps) {
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  /* Remember what had focus *before* the dialog opened, while it still had it. */
  useEffect(() => {
    if (open) restoreFocusTo.current = document.activeElement as HTMLElement | null;
  }, [open]);

  useEffect(() => {
    if (!open) return;

    /* Cancel, not confirm. A stray Enter should never be the thing that deletes a
       product. */
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  /* Put focus back where it came from. Runs on close, so it covers Escape, the
     backdrop and the confirm button alike. */
  useEffect(() => {
    if (open) return;
    restoreFocusTo.current?.focus?.();
    restoreFocusTo.current = null;
  }, [open]);

  const handleConfirm = useCallback(() => {
    void onConfirm();
  }, [onConfirm]);

  /* `createPortal` needs a document. During a server render there is none, and a
     dialog is never in the first paint, so returning null is safe. */
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div key="confirm" className="fixed inset-0 z-80 flex items-end justify-center p-4 sm:items-center">
          <motion.div
            aria-hidden="true"
            onClick={onClose}
            className="absolute inset-0 bg-charcoal/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
          />

          <motion.div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-description"
            className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-card-lift"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion
                ? { opacity: 0, transition: { duration: 0.1 } }
                : { opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.15, ease: "easeOut" } }
            }
            transition={{ type: "spring", duration: 0.35, bounce: 0 }}
          >
            <span
              aria-hidden="true"
              className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <AlertTriangle size={20} strokeWidth={1.75} />
            </span>

            <h2
              id="confirm-title"
              className="mt-4 font-serif text-xl font-semibold tracking-tight text-foreground"
            >
              {title}
            </h2>

            <p id="confirm-description" className="mt-2 text-sm leading-relaxed text-muted">
              {description}
              {subject ? (
                <>
                  {" "}
                  <span className="font-semibold text-foreground">{subject}</span> cannot be
                  recovered once this is done.
                </>
              ) : null}
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                ref={cancelRef}
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="inline-flex h-11 cursor-pointer items-center justify-center rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors duration-150 ease-out hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cancelLabel}
              </button>

              <button
                ref={confirmRef}
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="inline-flex h-11 cursor-pointer items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-background transition-colors duration-150 ease-out hover:bg-primary-deep active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Working…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}