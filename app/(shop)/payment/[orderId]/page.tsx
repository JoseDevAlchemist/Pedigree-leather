"use client";

/**
 * Payment page — client component for selecting payment method and entering details.
 *
 * Three payment methods:
 * - M-Pesa (STK push)
 * - Card (Flutterwave)
 * - Pay on delivery / Pay at shop
 *
 * Each method has its own form that slides in with Framer Motion.
 */

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Check, CreditCard, Smartphone, Truck, Loader2, AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";

import { formatPrice } from "@/lib/format";
import { markPaymentMethodAction } from "@/lib/actions/orders";
import { initiateMpesaPayment, initiateCardPayment } from "@/lib/payment-stubs";
import { normalizeKenyanPhone, isValidKenyanPhone, formatKenyanPhone, formatCardNumber, luhnCheck, formatExpiry, isValidExpiry, isValidCVC } from "@/lib/payment-utils";
import { toast } from "sonner";

/* ---------------------------------------------------------------------------
   Types
   --------------------------------------------------------------------------- */

interface OrderWithItems {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_method: "delivery" | "pickup";
  delivery_address: string | null;
  total: number;
  payment_method: string | null;
  payment_status: string;
}

interface PaymentMethod {
  id: "mpesa" | "card" | "pay_on_delivery" | "pay_at_shop";
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  available: boolean;
}

/* ---------------------------------------------------------------------------
   Payment page
   --------------------------------------------------------------------------- */

export default function PaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  // Form states
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [mpesaPhoneError, setMpesaPhoneError] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardNameError, setCardNameError] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardNumberError, setCardNumberError] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardExpiryError, setCardExpiryError] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardCvcError, setCardCvcError] = useState("");
  const [showCvc, setShowCvc] = useState(false);

  // Fetch order on mount
  useEffect(() => {
    async function fetchOrder() {
      try {
        const resolvedParams = await params;
        const res = await fetch(`/api/orders/${resolvedParams.orderId}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (res.status === 404 || res.status === 400) {
            router.push("/404");
          } else {
            toast.error("Failed to load order");
            router.push("/");
          }
          return;
        }
        const data = await res.json();
        setOrder(data);
        // Default to first available method
        const methods = getPaymentMethods(data);
        if (methods.length > 0) {
          setSelectedMethod(methods[0].id);
          setFocusedIndex(0);
        }
      } catch {
        toast.error("Something went wrong");
        router.push("/");
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [params, router]);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 md:px-8">
        <div className="flex items-center justify-center">
          <Loader2 className="size-8 text-primary animate-spin" />
        </div>
      </main>
    );
  }

  if (!order) {
    return null;
  }

  if (order.payment_status === "paid") {
    router.push(`/order/${order.id}`);
    return null;
  }

  const paymentMethods = getPaymentMethods(order);

  const handleConfirm = async () => {
    if (!selectedMethod || confirming) return;
    setConfirming(true);

    const methodMap: Record<string, "mpesa" | "card" | "pay_on_delivery"> = {
      mpesa: "mpesa",
      card: "card",
      pay_on_delivery: "pay_on_delivery",
      pay_at_shop: "pay_on_delivery",
    };

    try {
      if (selectedMethod === "mpesa") {
        // Validate phone
        if (!isValidKenyanPhone(mpesaPhone)) {
          setMpesaPhoneError("Enter a valid Kenyan phone number");
          setConfirming(false);
          return;
        }

        // Call M-Pesa stub
        const result = await initiateMpesaPayment(order.id, mpesaPhone);
        if (!result.ok) {
          toast.error(result.error || "M-Pesa payment failed");
          setConfirming(false);
          return;
        }

        // Mark payment method and redirect
        await markPaymentMethodAction(order.id, methodMap[selectedMethod]);
        router.push(`/order/${order.id}`);
        toast.success("M-Pesa payment initiated! Check your phone.");
      } else if (selectedMethod === "card") {
        // Validate card form
        let hasError = false;

        if (!cardName.trim() || cardName.trim().split(/\s+/).length < 2) {
          setCardNameError("Enter cardholder name (at least 2 words)");
          hasError = true;
        } else {
          setCardNameError("");
        }

        if (!luhnCheck(cardNumber)) {
          setCardNumberError("Enter a valid card number");
          hasError = true;
        } else {
          setCardNumberError("");
        }

        if (!isValidExpiry(cardExpiry)) {
          setCardExpiryError("Enter a valid future expiry (MM/YY)");
          hasError = true;
        } else {
          setCardExpiryError("");
        }

        if (!isValidCVC(cardCvc)) {
          setCardCvcError("Enter a valid CVC (3-4 digits)");
          hasError = true;
        } else {
          setCardCvcError("");
        }

        if (hasError) {
          setConfirming(false);
          return;
        }

        // Call card stub
        const result = await initiateCardPayment(order.id, order.total);
        if (!result.ok) {
          toast.error(result.error || "Card payment failed");
          setConfirming(false);
          return;
        }

        // If checkoutUrl provided, redirect there; otherwise mark and redirect
        if (result.checkoutUrl && result.checkoutUrl.startsWith("http")) {
          window.location.href = result.checkoutUrl;
          return;
        }

        await markPaymentMethodAction(order.id, methodMap[selectedMethod]);
        router.push(`/order/${order.id}`);
        toast.success("Card payment processed!");
      } else {
        // Pay on delivery / pay at shop
        const result = await markPaymentMethodAction(order.id, methodMap[selectedMethod]);
        if (result.ok) {
          router.push(`/order/${order.id}`);
          toast.success("Order confirmed!");
        } else {
          toast.error(result.error || "Failed to confirm payment method");
        }
      }
    } catch (error) {
      console.error("[payment] Error:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const lastIndex = paymentMethods.length - 1;
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        setFocusedIndex((i) => (i === lastIndex ? 0 : i + 1));
        break;
      case "ArrowLeft":
        e.preventDefault();
        setFocusedIndex((i) => (i === 0 ? lastIndex : i - 1));
        break;
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((i) => (i === lastIndex ? 0 : i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((i) => (i === 0 ? lastIndex : i - 1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        setSelectedMethod(paymentMethods[index].id);
        setFocusedIndex(index);
        break;
      case "Home":
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case "End":
        e.preventDefault();
        setFocusedIndex(lastIndex);
        break;
    }
  };

  const currentMethod = paymentMethods.find((m) => m.id === selectedMethod);
  const isDelivery = order.delivery_method === "delivery";

  return (
    <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="font-mono text-sm text-muted">Order #{order.order_number}</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Complete your payment
        </h1>
      </header>

      <div className="space-y-8">
        {/* Payment method cards */}
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          role="radiogroup"
          aria-label="Payment method"
        >
          {paymentMethods.map((method, index) => (
            <PaymentMethodCard
              key={method.id}
              method={method}
              isSelected={selectedMethod === method.id}
              isFocused={focusedIndex === index}
              onSelect={() => {
                setSelectedMethod(method.id);
                setFocusedIndex(index);
              }}
              onKeyDown={(e) => handleKeyDown(e, index)}
              reduceMotion={reduceMotion ?? false}
            />
          ))}
        </div>

        {/* Order total */}
        <div className="rounded-xl border border-border bg-card p-5 text-center">
          <p className="text-sm text-muted">Order total</p>
          <p className="mt-2 font-serif text-4xl font-bold tabular-nums text-foreground">
            {formatPrice(order.total)}
          </p>
        </div>

        {/* Method-specific form */}
        <AnimatePresence mode="wait">
          {selectedMethod === "mpesa" && (
            <MpesaForm
              key="mpesa"
              total={order.total}
              phone={mpesaPhone}
              phoneError={mpesaPhoneError}
              onPhoneChange={(val) => {
                setMpesaPhone(formatKenyanPhone(val));
                if (mpesaPhoneError) setMpesaPhoneError("");
              }}
              onSubmit={handleConfirm}
              isSubmitting={confirming}
              reduceMotion={reduceMotion ?? false}
            />
          )}
          {selectedMethod === "card" && (
            <CardForm
              key="card"
              total={order.total}
              name={cardName}
              nameError={cardNameError}
              onNameChange={(val) => {
                setCardName(val);
                if (cardNameError) setCardNameError("");
              }}
              number={cardNumber}
              numberError={cardNumberError}
              onNumberChange={(val) => {
                setCardNumber(formatCardNumber(val));
                if (cardNumberError) setCardNumberError("");
              }}
              expiry={cardExpiry}
              expiryError={cardExpiryError}
              onExpiryChange={(val) => {
                setCardExpiry(formatExpiry(val));
                if (cardExpiryError) setCardExpiryError("");
              }}
              cvc={cardCvc}
              cvcError={cardCvcError}
              onCvcChange={(val) => {
                setCardCvc(val);
                if (cardCvcError) setCardCvcError("");
              }}
              showCvc={showCvc}
              onToggleCvc={() => setShowCvc((v) => !v)}
              onSubmit={handleConfirm}
              isSubmitting={confirming}
              reduceMotion={reduceMotion ?? false}
            />
          )}
          {(selectedMethod === "pay_on_delivery" || selectedMethod === "pay_at_shop") && (
            <PayOnDeliveryForm
              key={selectedMethod}
              total={order.total}
              isDelivery={isDelivery}
              onSubmit={handleConfirm}
              isSubmitting={confirming}
              reduceMotion={reduceMotion ?? false}
            />
          )}
        </AnimatePresence>

        {/* Demo note */}
        <p className="text-center text-xs text-muted">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            Payment integration coming soon — demo flow
          </span>
        </p>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------------------
   Payment method card component
   --------------------------------------------------------------------------- */

interface PaymentMethodCardProps {
  method: PaymentMethod;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  reduceMotion: boolean;
}

function PaymentMethodCard({
  method,
  isSelected,
  isFocused,
  onSelect,
  onKeyDown,
  reduceMotion,
}: PaymentMethodCardProps) {
  const cardVariants = {
    unselected: {
      borderColor: "var(--border)",
      backgroundColor: "var(--card)",
    },
    selected: {
      borderColor: "var(--primary)",
      backgroundColor: "var(--primary)/0.05",
    },
    hover: {
      borderColor: "var(--primary)/0.4",
    },
  };

  const iconVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.15, ease: "easeOut" as const } },
  };

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      onKeyDown={onKeyDown}
      tabIndex={isFocused ? 0 : -1}
      role="radio"
      aria-checked={isSelected}
      aria-label={method.label}
      className={`
        relative group flex h-full flex-col items-start gap-3 rounded-xl border-2 p-5
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2
        ${isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 bg-card"}
      `}
      initial={false}
      animate={isSelected ? "selected" : "unselected"}
      variants={cardVariants}
      transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
    >
      <div
        className={`
          flex h-10 w-10 items-center justify-center rounded-lg transition-colors
          ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}
        `}
        aria-hidden="true"
      >
        {method.icon}
      </div>

      <div className="flex-1">
        <h3 className="font-medium text-foreground">{method.label}</h3>
        <p className="mt-1 text-sm text-muted">{method.subtitle}</p>
      </div>

      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={iconVariants}
            className="absolute top-3 right-3"
            aria-hidden="true"
          >
            <Check className="size-5 text-primary" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Focus ring for keyboard navigation */}
      {isFocused && !isSelected && (
        <div
          className="absolute inset-0 rounded-xl ring-2 ring-primary/40 ring-offset-2 ring-offset-background pointer-events-none"
          aria-hidden="true"
        />
      )}
    </motion.button>
  );
}

/* ---------------------------------------------------------------------------
   M-Pesa Form
   --------------------------------------------------------------------------- */

interface MpesaFormProps {
  total: number;
  phone: string;
  phoneError: string;
  onPhoneChange: (val: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  reduceMotion: boolean;
}

function MpesaForm({
  total,
  phone,
  phoneError,
  onPhoneChange,
  onSubmit,
  isSubmitting,
  reduceMotion,
}: MpesaFormProps) {
  return (
    <motion.form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
      transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
      className="space-y-4 rounded-xl border border-border bg-card p-5"
    >
      <h2 className="font-sans text-lg font-semibold tracking-wide uppercase text-foreground">
        M-Pesa
      </h2>

      <div className="space-y-2">
        <label htmlFor="mpesa-phone" className="block text-sm font-medium text-foreground">
          Phone number <span className="text-primary" aria-hidden="true">*</span>
        </label>
        <input
          type="tel"
          id="mpesa-phone"
          autoComplete="tel"
          placeholder="+254 7XX XXX XXX"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted"
          disabled={isSubmitting}
          aria-invalid={phoneError ? "true" : "false"}
          aria-describedby={phoneError ? "mpesa-phone-error" : "mpesa-phone-hint"}
        />
        {phoneError ? (
          <p id="mpesa-phone-error" className="text-sm text-destructive" role="alert">
            {phoneError}
          </p>
        ) : (
          <p id="mpesa-phone-hint" className="text-sm text-muted">
            You&apos;ll receive an STK push prompt on your phone to enter your M-Pesa PIN.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-semibold tracking-wide text-background transition-colors duration-200 ease-out hover:bg-primary-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:bg-muted/50 disabled:text-background"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Initiating…
          </>
        ) : (
          `Pay ${formatPrice(total)} with M-Pesa`
        )}
      </button>

      <p className="text-center text-xs text-muted">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
          <AlertCircle className="size-3" aria-hidden="true" />
          M-Pesa integration coming soon
        </span>
      </p>
    </motion.form>
  );
}

/* ---------------------------------------------------------------------------
   Card Form
   --------------------------------------------------------------------------- */

interface CardFormProps {
  total: number;
  name: string;
  nameError: string;
  onNameChange: (val: string) => void;
  number: string;
  numberError: string;
  onNumberChange: (val: string) => void;
  expiry: string;
  expiryError: string;
  onExpiryChange: (val: string) => void;
  cvc: string;
  cvcError: string;
  onCvcChange: (val: string) => void;
  showCvc: boolean;
  onToggleCvc: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  reduceMotion: boolean;
}

function CardForm({
  total,
  name,
  nameError,
  onNameChange,
  number,
  numberError,
  onNumberChange,
  expiry,
  expiryError,
  onExpiryChange,
  cvc,
  cvcError,
  onCvcChange,
  showCvc,
  onToggleCvc,
  onSubmit,
  isSubmitting,
  reduceMotion,
}: CardFormProps) {
  return (
    <motion.form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
      transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
      className="space-y-4 rounded-xl border border-border bg-card p-5"
    >
      <h2 className="font-sans text-lg font-semibold tracking-wide uppercase text-foreground">
        Card
      </h2>

      <div className="space-y-2">
        <label htmlFor="card-name" className="block text-sm font-medium text-foreground">
          Cardholder name <span className="text-primary" aria-hidden="true">*</span>
        </label>
        <input
          type="text"
          id="card-name"
          autoComplete="cc-name"
          placeholder="John Doe"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted"
          disabled={isSubmitting}
          aria-invalid={nameError ? "true" : "false"}
        />
        {nameError && (
          <p className="text-sm text-destructive" role="alert">{nameError}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="card-number" className="block text-sm font-medium text-foreground">
          Card number <span className="text-primary" aria-hidden="true">*</span>
        </label>
        <input
          type="text"
          id="card-number"
          autoComplete="cc-number"
          placeholder="1234 5678 9012 3456"
          value={number}
          onChange={(e) => onNumberChange(e.target.value)}
          maxLength={19}
          className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm font-mono tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted"
          disabled={isSubmitting}
          aria-invalid={numberError ? "true" : "false"}
        />
        {numberError && (
          <p className="text-sm text-destructive" role="alert">{numberError}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="card-expiry" className="block text-sm font-medium text-foreground">
            Expiry (MM/YY) <span className="text-primary" aria-hidden="true">*</span>
          </label>
          <input
            type="text"
            id="card-expiry"
            autoComplete="cc-exp"
            placeholder="12/25"
            value={expiry}
            onChange={(e) => onExpiryChange(e.target.value)}
            maxLength={5}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm font-mono tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted"
            disabled={isSubmitting}
            aria-invalid={expiryError ? "true" : "false"}
          />
          {expiryError && (
            <p className="text-sm text-destructive" role="alert">{expiryError}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="card-cvc" className="block text-sm font-medium text-foreground">
            CVC <span className="text-primary" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <input
              type={showCvc ? "text" : "password"}
              id="card-cvc"
              autoComplete="cc-csc"
              placeholder="123"
              value={cvc}
              onChange={(e) => onCvcChange(e.target.value)}
              maxLength={4}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm font-mono tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted pr-12"
              disabled={isSubmitting}
              aria-invalid={cvcError ? "true" : "false"}
            />
            <button
              type="button"
              onClick={onToggleCvc}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              aria-label={showCvc ? "Hide CVC" : "Show CVC"}
            >
              {showCvc ? <EyeOff size={18} strokeWidth={2} aria-hidden="true" /> : <Eye size={18} strokeWidth={2} aria-hidden="true" />}
            </button>
          </div>
          {cvcError && (
            <p className="text-sm text-destructive" role="alert">{cvcError}</p>
          )}
        </div>
      </div>

      <p className="text-sm text-muted flex items-center gap-1.5">
        <CheckCircle className="size-4 text-accent" aria-hidden="true" />
        Your card details are never stored on our servers. This is a secure form.
      </p>

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-semibold tracking-wide text-background transition-colors duration-200 ease-out hover:bg-primary-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:bg-muted/50 disabled:text-background"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Processing…
          </>
        ) : (
          `Pay ${formatPrice(total)} with card`
        )}
      </button>

      <p className="text-center text-xs text-muted">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
          <AlertCircle className="size-3" aria-hidden="true" />
          Card payments coming soon
        </span>
      </p>
    </motion.form>
  );
}

/* ---------------------------------------------------------------------------
   Pay on Delivery / Pay at Shop Form
   --------------------------------------------------------------------------- */

interface PayOnDeliveryFormProps {
  total: number;
  isDelivery: boolean;
  onSubmit: () => void;
  isSubmitting: boolean;
  reduceMotion: boolean;
}

function PayOnDeliveryForm({
  total,
  isDelivery,
  onSubmit,
  isSubmitting,
  reduceMotion,
}: PayOnDeliveryFormProps) {
  return (
    <motion.form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
      transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
      className="space-y-4 rounded-xl border border-border bg-card p-5"
    >
      <h2 className="font-sans text-lg font-semibold tracking-wide uppercase text-foreground">
        {isDelivery ? "Pay on delivery" : "Pay at shop"}
      </h2>

      <div className="flex items-start gap-3">
        {isDelivery ? (
          <Truck className="mt-1 size-6 shrink-0 text-accent" aria-hidden="true" />
        ) : (
          <CreditCard className="mt-1 size-6 shrink-0 text-accent" aria-hidden="true" />
        )}
        <div>
          <p className="font-medium text-foreground">
            {isDelivery ? "Pay the rider when your order arrives" : "Pay in person when you pick up"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {isDelivery
              ? "Cash or M-Pesa accepted. The rider will confirm payment."
              : "Cash, M-Pesa, or card accepted at the shop."}
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-semibold tracking-wide text-background transition-colors duration-200 ease-out hover:bg-primary-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:bg-muted/50 disabled:text-background"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Confirming…
          </>
        ) : (
          "Confirm order"
        )}
      </button>
    </motion.form>
  );
}

/* ---------------------------------------------------------------------------
   Helpers
   --------------------------------------------------------------------------- */

function getPaymentMethods(order: OrderWithItems): PaymentMethod[] {
  const methods: PaymentMethod[] = [
    {
      id: "mpesa",
      label: "M-Pesa",
      subtitle: "Pay via STK push to your phone",
      icon: <Smartphone className="size-5" aria-hidden="true" />,
      available: true,
    },
    {
      id: "card",
      label: "Card",
      subtitle: "Visa, Mastercard, Amex",
      icon: <CreditCard className="size-5" aria-hidden="true" />,
      available: true,
    },
  ];

  if (order.delivery_method === "delivery") {
    methods.push({
      id: "pay_on_delivery",
      label: "Pay on delivery",
      subtitle: "Pay the rider in cash or M-Pesa when your order arrives",
      icon: <Truck className="size-5" aria-hidden="true" />,
      available: true,
    });
  } else {
    methods.push({
      id: "pay_at_shop",
      label: "Pay at shop",
      subtitle: "Pay in person when you pick up your order",
      icon: <CreditCard className="size-5" aria-hidden="true" />,
      available: true,
    });
  }

  return methods;
}