"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Loader2,
  Lock,
  MapPin,
  ShieldCheck,
  Smartphone,
  Store,
  Truck,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";

import { formatPrice } from "@/lib/format";
import { markPaymentMethodAction } from "@/lib/actions/orders";
import {
  completeCardPlaceholderAction,
  startMpesaPaymentAction,
  submitManualMpesaAction,
} from "@/lib/actions/payments";
import {
  formatCardNumber,
  formatExpiry,
  isValidCVC,
  isValidExpiry,
  luhnCheck,
} from "@/lib/payment-utils";
import {
  KENYAN_PHONE_PREFIX,
  kenyanPhoneLocalDigits,
  kenyanPhoneSchema,
  normalizeKenyanPhone,
} from "@/lib/validation";

export interface PaymentOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_method: "delivery" | "pickup";
  delivery_address: string | null;
  total: number;
  payment_status: string;
}

type SelectablePaymentMethod = "mpesa" | "mpesa_manual" | "card";
type PaymentStatus = "idle" | "waiting" | "failed";

type FieldErrors = Partial<
  Record<
    "phone" | "manualCode" | "cardName" | "cardNumber" | "cardExpiry" | "cardCvc",
    string
  >
>;

type AvailableMethods = {
  mpesa: boolean;
  card: boolean;
  payOnDelivery: boolean;
};

const POLL_INTERVAL_MS = 3_000;
const PAYMENT_TIMEOUT_MS = 45_000;
const TIMEOUT_MESSAGE =
  "Payment timeout. We did not receive a confirmation. Please try again.";
const MPESA_TILL_NUMBER = "5655972";

/**
 * One large radio-style payment card. The header is the radio; the selected
 * card expands underneath it so the form fields feel like part of the choice.
 */
function PaymentMethodCard({
  id,
  title,
  subtitle,
  icon: Icon,
  selected,
  disabled,
  onSelect,
  children,
}: {
  id: SelectablePaymentMethod;
  title: string;
  subtitle: string;
  icon: typeof Smartphone;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <div
      className={`
        overflow-hidden rounded-[1.75rem] border-2 bg-card transition-all duration-300 ease-out
        ${
          selected
            ? "border-primary shadow-card-lift"
            : "border-border/80 shadow-card motion-safe:hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-card-lift"
        }
      `}
    >
      <label
        className={`
          group flex items-center gap-4 p-5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent sm:p-6
          ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}
        `}
      >
        <input
          type="radio"
          name="paymentMethod"
          value={id}
          checked={selected}
          onChange={onSelect}
          disabled={disabled}
          className="sr-only"
        />

        <span
          className={`
            flex size-12 shrink-0 items-center justify-center rounded-2xl transition-colors duration-300
            ${
              selected
                ? "bg-primary text-background"
                : "bg-primary/10 text-primary group-hover:bg-primary/20"
            }
          `}
        >
          <Icon className="size-5" strokeWidth={1.6} aria-hidden="true" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-sans text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {title}
          </span>
          <span className="mt-1 block text-sm leading-relaxed text-muted">
            {subtitle}
          </span>
        </span>

        <span
          aria-hidden="true"
          className={`
            flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300
            ${
              selected
                ? "border-primary bg-primary text-background"
                : "border-border bg-background"
            }
          `}
        >
          {selected && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      </label>

      <AnimatePresence initial={false}>
        {selected && (
          <motion.div
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{
              duration: reduceMotion ? 0 : 0.28,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="overflow-hidden"
          >
            <div
              className={`border-t border-border/70 px-5 pb-6 pt-5 transition-opacity duration-200 sm:px-6 ${
                disabled ? "opacity-60" : ""
              }`}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PaymentClient({
  order,
  availableMethods,
}: {
  order: PaymentOrder;
  availableMethods: AvailableMethods;
}) {
  const router = useRouter();
  const isPickup = order.delivery_method === "pickup";
  const firstName = order.customer_name.split(" ")[0] || "there";

  const defaultMethod: SelectablePaymentMethod = availableMethods.mpesa
    ? "mpesa"
    : "mpesa_manual";

  const [method, setMethod] = useState<SelectablePaymentMethod>(defaultMethod);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paymentAttemptRef = useRef(0);

  const [phone, setPhone] = useState(() =>
    kenyanPhoneLocalDigits(order.customer_phone),
  );
  const [manualCode, setManualCode] = useState("");
  const [tillCopied, setTillCopied] = useState(false);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  const isBusy = submitting || paymentStatus === "waiting";

  function clearError(field: keyof FieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    if (method === "mpesa") {
      const parsed = kenyanPhoneSchema.safeParse(phone);
      if (!parsed.success) {
        next.phone =
          parsed.error.issues[0]?.message ??
          "Enter a valid Kenyan M-Pesa number.";
      }
    }

    if (method === "mpesa_manual") {
      const code = manualCode.trim();
      if (!/^[A-Z0-9]{8,12}$/i.test(code)) {
        next.manualCode =
          "Enter the 8–12 character confirmation code from the M-Pesa SMS.";
      }
    }

    if (method === "card") {
      if (cardName.trim().split(/\s+/).length < 2) {
        next.cardName = "Enter the cardholder's full name.";
      }
      if (!luhnCheck(cardNumber)) {
        next.cardNumber = "That card number doesn't look right.";
      }
      if (!isValidExpiry(cardExpiry)) {
        next.cardExpiry = "Enter a valid future expiry date (MM/YY).";
      }
      if (!isValidCVC(cardCvc)) {
        next.cardCvc = "Enter the 3–4 digit security code.";
      }
    }

    return next;
  }

  function clearPaymentTimers() {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function startWaiting(attempt: number) {
    setPaymentStatus("waiting");
    setPaymentError(null);
    setSubmitting(false);

    let requestInFlight = false;

    const checkOrder = async () => {
      if (paymentAttemptRef.current !== attempt || requestInFlight) return;
      requestInFlight = true;

      try {
        const res = await fetch(`/api/orders/${order.id}`, {
          cache: "no-store",
        });
        if (!res.ok) return;

        const data = (await res.json()) as { payment_status?: string };
        if (paymentAttemptRef.current !== attempt) return;

        if (data.payment_status === "paid") {
          paymentAttemptRef.current += 1;
          clearPaymentTimers();
          setPaymentStatus("idle");
          toast.success("Payment received — thank you!");
          router.push(`/order/${order.id}`);
          return;
        }

        if (data.payment_status === "failed") {
          paymentAttemptRef.current += 1;
          clearPaymentTimers();
          setPaymentStatus("failed");
          setPaymentError("Payment was not completed. Please try again.");
          toast.error("Payment was not completed. Please try again.");
        }
      } catch {
        /* Network hiccup: keep polling until the 45-second timeout. */
      } finally {
        requestInFlight = false;
      }
    };

    /* Check immediately, then every three seconds until paid or timed out. */
    void checkOrder();
    pollIntervalRef.current = setInterval(() => {
      void checkOrder();
    }, POLL_INTERVAL_MS);

    timeoutRef.current = setTimeout(() => {
      if (paymentAttemptRef.current !== attempt) return;

      /* Invalidate any request already in flight so a late response cannot
         overwrite the timeout state. */
      paymentAttemptRef.current += 1;
      clearPaymentTimers();
      setPaymentStatus("failed");
      setPaymentError(TIMEOUT_MESSAGE);
      toast.error(TIMEOUT_MESSAGE);
    }, PAYMENT_TIMEOUT_MS);
  }

  function resetPaymentState() {
    paymentAttemptRef.current += 1;
    clearPaymentTimers();
    setPaymentStatus("idle");
    setPaymentError(null);
    setSubmitting(false);
  }

  function handleSelectMethod(nextMethod: SelectablePaymentMethod) {
    if (isBusy) return;
    resetPaymentState();
    setErrors({});
    setMethod(nextMethod);
  }

  useEffect(() => {
    return () => {
      /* Closing the tab or navigating away clears both timers. Browsers also
         stop a closed tab, but this covers client-side navigation and unmounts. */
      paymentAttemptRef.current += 1;
      if (pollIntervalRef.current !== null) {
        clearInterval(pollIntervalRef.current);
      }
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || paymentStatus === "waiting") return;

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error("Check the highlighted fields and try again.");
      return;
    }

    setSubmitting(true);
    setPaymentError(null);

    try {
      if (method === "mpesa") {
        /* A retry must not inherit the previous interval or timeout. */
        paymentAttemptRef.current += 1;
        clearPaymentTimers();
        const attempt = paymentAttemptRef.current;
        /* Show the overlay immediately, while the server is contacting Daraja. */
        setPaymentStatus("waiting");

        const result = await startMpesaPaymentAction({
          orderId: order.id,
          phone: normalizeKenyanPhone(phone),
        });
        if (!result.ok) {
          throw new Error(result.error || "M-Pesa could not be started.");
        }

        /* The component may have unmounted or started another attempt while
           the server action was in flight. */
        if (paymentAttemptRef.current !== attempt) return;

        toast.success("M-Pesa prompt sent. Check your phone.");
        startWaiting(attempt);
        return; /* Don't redirect — polling will handle it. */
      }

      if (method === "mpesa_manual") {
        const result = await submitManualMpesaAction({
          orderId: order.id,
          code: manualCode,
        });
        if (!result.ok) {
          throw new Error(result.error || "Could not save the confirmation code.");
        }

        toast.success("Confirmation code saved. We'll verify your payment.");
        router.push(`/order/${order.id}`);
        return;
      }

      if (method === "card") {
        /* Deliberate demo while the real card provider keys are pending. No
           card data leaves the browser; the server only records the outcome. */
        await new Promise((resolve) => window.setTimeout(resolve, 1_200));
        toast.info("Card integration coming soon");

        const result = await completeCardPlaceholderAction(order.id);
        if (!result.ok) {
          throw new Error(result.error || "Could not record the demo payment.");
        }

        toast.success("Demo payment recorded. Thank you!");
        router.push(`/order/${order.id}`);
        return;
      }
    } catch (error) {
      console.error("[payment] Error:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";

      if (method === "mpesa") {
        paymentAttemptRef.current += 1;
        clearPaymentTimers();
        setPaymentStatus("failed");
        setPaymentError(message);
      }

      if (method === "mpesa_manual") {
        setErrors({ manualCode: message });
      }

      toast.error(message);
      setSubmitting(false);
    }
  }

  async function handlePayOnDelivery() {
    if (isBusy) return;

    setSubmitting(true);
    try {
      const result = await markPaymentMethodAction(
        order.id,
        "pay_on_delivery",
      );
      if (!result.ok) {
        throw new Error(result.error || "We couldn't save your payment method.");
      }
      toast.success("Order confirmed. Thank you!");
      router.push(`/order/${order.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
      setSubmitting(false);
    }
  }

  async function copyTillNumber() {
    try {
      await navigator.clipboard.writeText(MPESA_TILL_NUMBER);
      setTillCopied(true);
      toast.success("Till number copied.");
      window.setTimeout(() => setTillCopied(false), 2_000);
    } catch {
      toast.error(`Copy failed. The till number is ${MPESA_TILL_NUMBER}.`);
    }
  }

  return (
    <main
      id="main"
      className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-12"
    >
      {paymentStatus === "waiting" && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-2xl">
            <Loader2
              className="mx-auto size-10 animate-spin text-primary"
              aria-hidden="true"
            />
            <h2 className="mt-5 font-serif text-xl font-semibold text-foreground">
              Waiting for M-Pesa
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Check your phone for the M-Pesa prompt...
            </p>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Enter your M-Pesa PIN to approve the payment. This page will
              update automatically.
            </p>
          </div>
        </div>
      )}

      <section className="relative overflow-hidden rounded-[2rem] bg-primary-dark px-6 py-8 text-background shadow-card-lift sm:px-10 sm:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-accent/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-36 -left-20 size-72 rounded-full bg-background/5 blur-3xl"
        />

        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent-ink">
              Pedigree Leather · Secure checkout
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-background/15 bg-background/10 px-3 py-1 text-[11px] font-medium text-background/80">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Encrypted
            </span>
          </div>

          <div className="mt-8">
            <p className="text-sm font-medium text-background/60">
              Total to pay
            </p>
            <h1 className="mt-1 font-serif text-5xl font-semibold tracking-tight text-background sm:text-6xl">
              {formatPrice(order.total)}
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-background/65">
              Thanks, {firstName}. Choose how you&apos;d like to pay for order{" "}
              <span className="font-mono text-background/85">
                {order.order_number}
              </span>
              .
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-background/60">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden="true" />
              {isPickup
                ? "Collect at the shop"
                : order.delivery_address
                  ? `Deliver to ${order.delivery_address}`
                  : "Delivery details confirmed"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="size-3.5" aria-hidden="true" />
              Your payment details stay private
            </span>
          </div>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="payment-method-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
              Payment method
            </p>
            <h2
              id="payment-method-heading"
              className="mt-1.5 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
            >
              Choose how to pay
            </h2>
          </div>
          <p className="max-w-xs text-right text-xs leading-relaxed text-muted">
            Select an option to see the next step. You can change it before
            paying.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          aria-busy={paymentStatus === "waiting"}
          className="mt-6 space-y-5"
        >
          <fieldset disabled={isBusy} className="space-y-4">
            <legend className="sr-only">Payment method</legend>

            {availableMethods.mpesa && (
              <PaymentMethodCard
                id="mpesa"
                title="M-Pesa STK Push"
                subtitle="Receive a prompt on your phone"
                icon={Smartphone}
                selected={method === "mpesa"}
                disabled={isBusy}
                onSelect={() => handleSelectMethod("mpesa")}
              >
                <div className="space-y-5">
                  <div>
                    <label
                      htmlFor="mpesa-phone"
                      className="block text-sm font-medium text-foreground"
                    >
                      Phone number
                    </label>
                    <div className="relative mt-2">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-medium text-muted"
                      >
                        {KENYAN_PHONE_PREFIX}
                      </span>
                      <input
                        id="mpesa-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        value={phone}
                        onChange={(event) => {
                          setPhone(
                            kenyanPhoneLocalDigits(event.target.value),
                          );
                          clearError("phone");
                        }}
                        placeholder="712345678"
                        aria-invalid={errors.phone ? "true" : "false"}
                        aria-describedby={
                          errors.phone ? "mpesa-phone-error" : "mpesa-phone-hint"
                        }
                        className="w-full rounded-xl border border-border bg-background py-3 pr-4 pl-[4.6rem] text-sm tabular-nums tracking-wide text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    {errors.phone ? (
                      <p
                        id="mpesa-phone-error"
                        role="alert"
                        className="mt-1.5 flex items-start gap-1.5 text-sm text-destructive"
                      >
                        <AlertCircle
                          className="mt-0.5 size-4 shrink-0"
                          aria-hidden="true"
                        />
                        {errors.phone}
                      </p>
                    ) : (
                      <p
                        id="mpesa-phone-hint"
                        className="mt-1.5 text-sm text-muted"
                      >
                        Enter the 9 digits after +254. We&apos;ll send a prompt
                        to this number.
                      </p>
                    )}
                  </div>

                  {paymentStatus === "failed" && (
                    <div
                      role="alert"
                      className="flex flex-col gap-3 rounded-xl border border-destructive bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-2.5">
                        <AlertCircle
                          className="mt-0.5 size-5 shrink-0 text-destructive"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="text-sm font-semibold text-destructive">
                            Payment not confirmed
                          </p>
                          <p className="mt-0.5 text-sm leading-relaxed text-destructive/80">
                            {paymentError || TIMEOUT_MESSAGE}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={resetPaymentState}
                        className="shrink-0 rounded-full border border-destructive px-4 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive"
                      >
                        Try again
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold tracking-wide text-background transition-colors duration-200 ease-out hover:bg-primary-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:bg-muted/50"
                  >
                    {isBusy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Smartphone className="size-4" aria-hidden="true" />
                    )}
                    {paymentStatus === "waiting"
                      ? "Waiting for confirmation…"
                      : submitting
                        ? "Sending prompt…"
                        : `Pay ${formatPrice(order.total)}`}
                  </button>

                  <p className="text-center text-xs leading-relaxed text-muted">
                    Approve the prompt on your phone. This page updates
                    automatically.
                  </p>
                </div>
              </PaymentMethodCard>
            )}

            <PaymentMethodCard
              id="mpesa_manual"
              title="M-Pesa Till Number"
              subtitle="Pay manually via Till Number"
              icon={Store}
              selected={method === "mpesa_manual"}
              disabled={isBusy}
              onSelect={() => handleSelectMethod("mpesa_manual")}
            >
              <div className="space-y-5">
                <div className="rounded-2xl border border-border bg-background p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
                        Lipa na M-Pesa · Buy Goods
                      </p>
                      <p className="mt-1.5 font-mono text-3xl font-bold tracking-[0.18em] text-foreground">
                        {MPESA_TILL_NUMBER}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={copyTillNumber}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {tillCopied ? (
                        <Check className="size-4 text-primary" aria-hidden="true" />
                      ) : (
                        <Copy className="size-4" aria-hidden="true" />
                      )}
                      {tillCopied ? "Copied" : "Copy till"}
                    </button>
                  </div>
                </div>

                <ol className="grid gap-2 text-sm leading-relaxed text-muted sm:grid-cols-2">
                  <li className="flex gap-2">
                    <span className="font-mono text-xs text-accent-ink">01</span>
                    Go to M-Pesa.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-mono text-xs text-accent-ink">02</span>
                    Select Lipa na M-Pesa.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-mono text-xs text-accent-ink">03</span>
                    Choose Buy Goods and Services.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-mono text-xs text-accent-ink">04</span>
                    Enter Till Number {MPESA_TILL_NUMBER}.
                  </li>
                  <li className="flex gap-2 sm:col-span-2">
                    <span className="font-mono text-xs text-accent-ink">05</span>
                    Enter {formatPrice(order.total)} and confirm.
                  </li>
                </ol>

                <div>
                  <label
                    htmlFor="manual-code"
                    className="block text-sm font-medium text-foreground"
                  >
                    M-Pesa confirmation code
                  </label>
                  <input
                    id="manual-code"
                    type="text"
                    inputMode="text"
                    autoComplete="one-time-code"
                    value={manualCode}
                    onChange={(event) => {
                      setManualCode(
                        event.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, "")
                          .slice(0, 12),
                      );
                      clearError("manualCode");
                    }}
                    placeholder="SFK12345678"
                    aria-invalid={errors.manualCode ? "true" : "false"}
                    aria-describedby={
                      errors.manualCode
                        ? "manual-code-error"
                        : "manual-code-hint"
                    }
                    className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm uppercase tracking-[0.18em] text-foreground placeholder:font-sans placeholder:normal-case placeholder:tracking-normal focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {errors.manualCode ? (
                    <p
                      id="manual-code-error"
                      role="alert"
                      className="mt-1.5 flex items-start gap-1.5 text-sm text-destructive"
                    >
                      <AlertCircle
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      {errors.manualCode}
                    </p>
                  ) : (
                    <p id="manual-code-hint" className="mt-1.5 text-sm text-muted">
                      Find the code in the M-Pesa SMS after paying.
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isBusy}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold tracking-wide text-background transition-colors duration-200 ease-out hover:bg-primary-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:bg-muted/50"
                >
                  {submitting && method === "mpesa_manual" ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                  )}
                  {submitting && method === "mpesa_manual"
                    ? "Saving…"
                    : "I have paid"}
                </button>

                <p className="text-center text-xs leading-relaxed text-muted">
                  We&apos;ll verify the code against our M-Pesa statement before
                  fulfilling the order.
                </p>
              </div>
            </PaymentMethodCard>

            {availableMethods.card && (
              <PaymentMethodCard
                id="card"
                title="Credit / Debit Card"
                subtitle="Visa, Mastercard, Amex"
                icon={CreditCard}
                selected={method === "card"}
                disabled={isBusy}
                onSelect={() => handleSelectMethod("card")}
              >
                <div className="space-y-5">
                  <div>
                    <label
                      htmlFor="card-name"
                      className="block text-sm font-medium text-foreground"
                    >
                      Cardholder name
                    </label>
                    <input
                      id="card-name"
                      type="text"
                      autoComplete="cc-name"
                      value={cardName}
                      onChange={(event) => {
                        setCardName(event.target.value);
                        clearError("cardName");
                      }}
                      aria-invalid={errors.cardName ? "true" : "false"}
                      aria-describedby={
                        errors.cardName ? "card-name-error" : undefined
                      }
                      className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    {errors.cardName && (
                      <p
                        id="card-name-error"
                        role="alert"
                        className="mt-1.5 flex items-start gap-1.5 text-sm text-destructive"
                      >
                        <AlertCircle
                          className="mt-0.5 size-4 shrink-0"
                          aria-hidden="true"
                        />
                        {errors.cardName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="card-number"
                      className="block text-sm font-medium text-foreground"
                    >
                      Card number
                    </label>
                    <input
                      id="card-number"
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      value={cardNumber}
                      onChange={(event) => {
                        setCardNumber(formatCardNumber(event.target.value));
                        clearError("cardNumber");
                      }}
                      aria-invalid={errors.cardNumber ? "true" : "false"}
                      aria-describedby={
                        errors.cardNumber ? "card-number-error" : undefined
                      }
                      placeholder="4242 4242 4242 4242"
                      maxLength={23}
                      className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm tabular-nums text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    {errors.cardNumber && (
                      <p
                        id="card-number-error"
                        role="alert"
                        className="mt-1.5 flex items-start gap-1.5 text-sm text-destructive"
                      >
                        <AlertCircle
                          className="mt-0.5 size-4 shrink-0"
                          aria-hidden="true"
                        />
                        {errors.cardNumber}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="card-expiry"
                        className="block text-sm font-medium text-foreground"
                      >
                        Expiry
                      </label>
                      <input
                        id="card-expiry"
                        type="text"
                        inputMode="numeric"
                        autoComplete="cc-exp"
                        value={cardExpiry}
                        onChange={(event) => {
                          setCardExpiry(formatExpiry(event.target.value));
                          clearError("cardExpiry");
                        }}
                        aria-invalid={errors.cardExpiry ? "true" : "false"}
                        aria-describedby={
                          errors.cardExpiry ? "card-expiry-error" : undefined
                        }
                        placeholder="MM/YY"
                        maxLength={5}
                        className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm tabular-nums text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      {errors.cardExpiry && (
                        <p
                          id="card-expiry-error"
                          role="alert"
                          className="mt-1.5 flex items-start gap-1.5 text-sm text-destructive"
                        >
                          <AlertCircle
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden="true"
                          />
                          {errors.cardExpiry}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="card-cvc"
                        className="block text-sm font-medium text-foreground"
                      >
                        Security code
                      </label>
                      <input
                        id="card-cvc"
                        type="password"
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        value={cardCvc}
                        onChange={(event) => {
                          setCardCvc(
                            event.target.value.replace(/\D/g, "").slice(0, 4),
                          );
                          clearError("cardCvc");
                        }}
                        aria-invalid={errors.cardCvc ? "true" : "false"}
                        aria-describedby={
                          errors.cardCvc ? "card-cvc-error" : undefined
                        }
                        placeholder="CVC"
                        maxLength={4}
                        className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm tabular-nums text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      {errors.cardCvc && (
                        <p
                          id="card-cvc-error"
                          role="alert"
                          className="mt-1.5 flex items-start gap-1.5 text-sm text-destructive"
                        >
                          <AlertCircle
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden="true"
                          />
                          {errors.cardCvc}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="rounded-xl border border-accent/25 bg-accent/10 px-4 py-3 text-xs leading-relaxed text-foreground/75">
                    <span className="font-semibold text-foreground">
                      Demo checkout.
                    </span>{" "}
                    No card is charged. Card integration is coming soon.
                  </p>

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold tracking-wide text-background transition-colors duration-200 ease-out hover:bg-primary-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:bg-muted/50"
                  >
                    {submitting && method === "card" ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Lock className="size-4" aria-hidden="true" />
                    )}
                    {submitting && method === "card"
                      ? "Processing…"
                      : "Pay securely"}
                  </button>
                </div>
              </PaymentMethodCard>
            )}
          </fieldset>

          {availableMethods.payOnDelivery && (
            <div className="flex flex-col gap-4 rounded-[1.5rem] border border-dashed border-border bg-card/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Truck className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Prefer to pay on delivery?
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    {isPickup
                      ? "Pay when you collect your order at the shop."
                      : "Pay our rider when your order arrives."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handlePayOnDelivery}
                disabled={isBusy}
                className="shrink-0 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50"
              >
                Choose pay on delivery
              </button>
            </div>
          )}
        </form>
      </section>
    </main>
  );
}
