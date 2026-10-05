"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertCircle, Check, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Toasts for the admin.
 *
 * Trigger — a save, a delete, a validation failure. Rules — one toast per action, no
 * stacking: a second toast replaces the first rather than queueing behind it, because
 * the admin's actions are sequential and a person waiting to read a message is a
 * person who cannot start the next save. Feedback — colour plus an icon plus a
 * sentence, never colour alone. Loops — auto-dismiss after four seconds, and a
 * failure stays until dismissed.
 *
 * Why failures do not auto-dismiss: the dismissible case is "that worked", which is
 * self-evident. The other case is "that did not work and here is what to do about
 * it", and a message that removes itself before it has been read is a message that
 * leaves the person guessing whether the save happened.
 *
 * `aria-live="polite"` on the region, not on each toast, so a screen reader announces
 * the message once rather than once per element. `role="status"` for success and
 * info, `role="alert"` for errors, which interrupts — correct, because an error is
 * the one case where waiting for the polite queue is wrong.
 *
 * Region is `aria-live` but its children mount after it, which some combinations of
 * screen reader and browser need a beat to notice. The `assertive` variant renders a
 * live region from the start; see the comment on `<ToastRegion>`.
 */

export type ToastVariant = "success" | "error" | "info";

export type Toast = {
  id: number;
  variant: ToastVariant;
  title: string;
  /** Optional second line. Keep it to one sentence. */
  description?: string;
};

type ToastContextValue = {
  toast: (variant: ToastVariant, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** Fail soft outside the provider, so a component can be rendered in isolation. */
const FALLBACK: ToastContextValue = {
  toast: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
  dismiss: () => {},
};

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (variant: ToastVariant, title: string, description?: string) => {
      const id = nextId.current++;

      /* Replace rather than stack, so there is at most one message on screen. A
         second toast arriving before the first has been read supersedes it: the
         admin's actions are sequential, and queueing messages behind each other
         means the message about the save you just made is not the one you see. */
      setToasts((current) => {
        const next = [...current, { id, variant, title, description }];
        return next.length > 1 ? [next[0]] : next;
      });

      /* Only successes and info leave themselves. */
      if (variant !== "error") {
        const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
        timers.current.set(id, timer);
      }
    },
    [dismiss],
  );

  /* Every pending timer is cleared on unmount, or a toast scheduled during a
     navigation fires against a component that no longer exists. */
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast("success", title, description),
      error: (title, description) => toast("error", title, description),
      info: (title, description) => toast("info", title, description),
    }),
    [dismiss, toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext) ?? FALLBACK;
}

/**
 * Icons per variant. Not decoration: each one is a different *shape*, so the
 * variant is legible without colour — which is the difference between a toast system
 * and a colour preference.
 */
const ICONS: Record<ToastVariant, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  success: Check,
  error: AlertCircle,
  info: Info,
};

/**
 * Dark on every variant.
 *
 * Not a shortcut. The admin's surfaces are cream, brown and charcoal, and a toast
 * that matched its variant would be a cream toast on a cream page and a brown toast
 * on a brown page. One high-contrast surface reads the same everywhere, and the icon
 * plus the wording carry the meaning — which is also why this does not depend on
 * colour to be understood.
 */
const VARIANT_ICON: Record<ToastVariant, string> = {
  success: "text-accent",
  error: "text-background",
  info: "text-background",
};

function ToastRegion({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    /* `pointer-events-none` on the container, re-enabled per toast: the region spans
       a corner of the viewport and an invisible box over the page would swallow
       clicks on whatever is underneath it. */
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-70 flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:bottom-0 sm:items-end sm:p-6"
    >
      <AnimatePresence initial={false}>
        {toasts.map((entry) => {
          const Icon = ICONS[entry.variant];

          return (
            <motion.div
              key={entry.id}
              /* `role="alert"` on errors interrupts; everything else is polite,
                 because being interrupted mid-sentence is rude and an error is the
                 only thing worth it. */
              role={entry.variant === "error" ? "alert" : "status"}
              layout={!reduceMotion}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reduceMotion
                  ? { opacity: 0, transition: { duration: 0.1 } }
                  : { opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.15, ease: "easeOut" } }
              }
              transition={{ type: "spring", duration: 0.32, bounce: 0 }}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-charcoal px-4 py-3 shadow-card-lift"
            >
              <Icon size={18} strokeWidth={2} className={`mt-0.5 shrink-0 ${VARIANT_ICON[entry.variant]}`} />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-background">{entry.title}</p>
                {entry.description ? (
                  <p className="mt-0.5 text-sm leading-snug text-background/70">{entry.description}</p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => onDismiss(entry.id)}
                aria-label="Dismiss"
                className="-m-1 shrink-0 cursor-pointer rounded-full p-1 text-background/50 transition-colors duration-150 ease-out hover:bg-background/10 hover:text-background focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}