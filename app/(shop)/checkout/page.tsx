"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Truck, MapPin, Package, CheckCircle, Loader2 } from "lucide-react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useCartDrawer } from "@/components/cart/CartDrawerProvider";
import { cartLineKey, useCartStore, useCartSubtotal } from "@/lib/store/cart";
import { formatPrice } from "@/lib/format";
import { originalProductImageUrl } from "@/lib/product-image-url";
import { createOrderAction } from "@/lib/actions/orders";
import {
  KENYAN_PHONE_PREFIX,
  kenyanPhoneLocalDigits,
  kenyanPhoneSchema,
  normalizeKenyanPhone,
} from "@/lib/validation";
import { toast } from "sonner";

interface ShopConfig {
  address: string;
  deliveryEnabled: boolean;
  deliveryFlatRate: number;
  freeDeliveryThreshold: number;
  pickupAvailable: boolean;
  pickupAddress?: string;
  pickupHours?: string;
  pickupInstructions?: string;
  deliveryEstimate?: string;
  preparationTime?: string;
  checkoutInstructions?: string;
  taxDisplayNote?: string;
}

interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
}

/* ---------------------------------------------------------------------------
   Zod schema (mirrors the server action)
   --------------------------------------------------------------------------- */

const checkoutSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: kenyanPhoneSchema,
  deliveryMethod: z.enum(["delivery", "pickup"]),
  deliveryAddress: z.string().optional(),
  notes: z.string().max(500, "Notes must be 500 characters or less").optional(),
}).refine(
  (data) => {
    if (data.deliveryMethod === "delivery") {
      return data.deliveryAddress && data.deliveryAddress.trim().length >= 10;
    }
    return true;
  },
  {
    message: "Please enter a delivery address (at least 10 characters)",
    path: ["deliveryAddress"],
  }
);

type CheckoutForm = z.infer<typeof checkoutSchema>;

/* ---------------------------------------------------------------------------
   Checkout page
   --------------------------------------------------------------------------- */

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const { isCartHydrated } = useCartDrawer();
  const hasItems = items.length > 0;
  const checkoutReady = isCartHydrated && hasItems;
  const subtotal = useCartSubtotal();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");

  /**
   * Set the instant an order is created, before the cart is cleared.
   *
   * Clearing the cart re-runs the empty-cart guard below. Without this flag
   * that guard wins the race against `router.push("/payment/...")` and sends
   * the customer to /bags with an "empty cart" toast — which is exactly what
   * looked like the payment page "reloading".
   */
  const orderPlacedRef = useRef(false);
  const checkoutAttempt = useRef<{ payload: string; id: string } | null>(null);

  // Redirect if the cart is genuinely empty (not because we just checked out).
  useEffect(() => {
    if (isCartHydrated && !hasItems && !orderPlacedRef.current) {
      router.replace("/category/bags");
      toast.info("Your cart is empty. Add something first.");
    }
  }, [hasItems, isCartHydrated, router]);

  const discountTotal = items.reduce((sum, item) =>
    sum + (item.basePrice - Math.round(item.unitPrice)) * item.quantity, 0);
  const beforeDiscount = subtotal + discountTotal;

  const {
    control,
    register,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      deliveryMethod: "delivery",
      name: "",
      email: "",
      phone: "",
      deliveryAddress: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!checkoutReady) return;

    const controller = new AbortController();
    const options = { cache: "no-store", signal: controller.signal } as const;
    async function fetchConfig() {
      try {
        const [configRes, zonesRes] = await Promise.all([
          fetch("/api/shop-config", options),
          fetch("/api/delivery-zones", options),
        ]);
        if (!configRes.ok || !zonesRes.ok) throw new Error("Checkout settings unavailable");
        const [config, availableZones]: [ShopConfig, DeliveryZone[]] = await Promise.all([
          configRes.json(), zonesRes.json(),
        ]);
        if (controller.signal.aborted) return;
        if (!config.deliveryEnabled && config.pickupAvailable) setValue("deliveryMethod", "pickup");
        setZones(availableZones);
        setShopConfig(config);
      } catch {
        if (!controller.signal.aborted) setConfigError(true);
      }
    }
    void fetchConfig();
    return () => controller.abort();
  }, [checkoutReady, setValue]);

  const deliveryMethod = useWatch({ control, name: "deliveryMethod" });
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId);
  const deliveryFee = shopConfig?.deliveryEnabled && deliveryMethod === "delivery" && subtotal < shopConfig.freeDeliveryThreshold
    ? selectedZone?.fee ?? shopConfig.deliveryFlatRate
    : 0;
  const total = subtotal + deliveryFee;

  /**
   * Runs only after react-hook-form has validated the form.
   *
   * The old handler re-entered `handleSubmit` from inside `onSubmit` and raced
   * it with a 100ms `setTimeout` to guess whether validation had failed. That
   * is also the handler that stalled: on success it lost the navigation race
   * to the empty-cart redirect. RHF's own `handleSubmit(onValid)` does the
   * same job without either problem.
   */
  const onValid = async (data: CheckoutForm) => {
    if (!checkoutReady || !shopConfig || isSubmitting) return;

    /* The line's stock was captured when it was added. Check it before the round
       trip so the shopper gets an immediate, specific answer rather than a generic
       failure. The server repeats the check against the live count, because a
       client component can be edited and stock can move while someone is typing. */
    const overStock = items.find((item) => {
      const available = item.stockQuantity ?? item.quantity;
      return item.quantity > available;
    });

    if (overStock) {
      toast.error(
        `Sorry, only ${overStock.stockQuantity} of ${overStock.name} in ${overStock.colorName} are available.`,
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare cart items for the server action
      const cartItemsForServer = items.map((item) => ({
        productId: item.productId,
        colorId: item.colorId,
        sizeId: item.sizeId,
        unitPrice: Math.round(item.unitPrice),
        quantity: item.quantity,
      }));

      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("email", data.email || "");
      /* The resolver has already transformed this, but normalising here makes
         the contract explicit: the server always receives +2547XXXXXXXX. */
      formData.append("phone", normalizeKenyanPhone(data.phone));
      formData.append("deliveryMethod", data.deliveryMethod);
      formData.append("deliveryAddress", data.deliveryAddress || "");
      formData.append("notes", data.notes || "");
      if (data.deliveryMethod === "delivery" && selectedZoneId) {
        const zone = zones.find((z) => z.id === selectedZoneId);
        if (zone) formData.append("zoneId", zone.id);
      }
      formData.append("cartItems", JSON.stringify(cartItemsForServer));
      const payload = JSON.stringify(Array.from(formData.entries()));
      if (checkoutAttempt.current?.payload !== payload) {
        checkoutAttempt.current = { payload, id: crypto.randomUUID() };
      }
      formData.append("requestId", checkoutAttempt.current.id);

      const result = await createOrderAction(formData);

      if (result.ok) {
        // Set the flag *before* clearing: the empty-cart effect runs on the
        // next render and must not send us back to /bags.
        orderPlacedRef.current = true;
        useCartStore.getState().clearCart();
        toast.success("Order created! Choose your payment method.");
        router.push(`/payment/${result.orderId}`);
        return; // keep the button busy until the route changes
      }

      toast.error(result.error);
    } catch (error) {
      console.error("[checkout] submit error:", error);
      toast.error("Something went wrong. Please try again.");
    }

    setIsSubmitting(false);
  };

  if (!checkoutReady) {
    return (
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Checkout
        </h1>
        <p className="mt-2 text-muted" role="status">
          {isCartHydrated ? "Loading…" : "Loading your cart…"}
        </p>
      </main>
    );
  }

  if (!shopConfig || (!shopConfig.deliveryEnabled && !shopConfig.pickupAvailable)) {
    const unavailable = configError || Boolean(shopConfig);
    return (
      <main id="main" className="mx-auto min-h-60 max-w-4xl px-4 py-12">
        <p role={unavailable ? "alert" : "status"}>{unavailable ? "Checkout is currently unavailable. Please try again later." : "Loading checkout options…"}</p>
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Checkout
        </h1>
        <p className="mt-2 text-muted">Enter your details and choose how you&apos;d like to receive your order.</p>
      </header>

      <form onSubmit={(event) => void handleSubmit(onValid)(event)} noValidate className="space-y-8">
        {/* Mobile: form first, summary below. Desktop: two columns */}
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Form section - 7 cols on desktop, full width on mobile */}
          <div className="lg:col-span-7 space-y-6">
            {/* Section 1: Your details */}
            <section className="space-y-4">
              <h2 className="font-sans text-lg font-semibold tracking-wide uppercase text-foreground">
                Your details
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="name" className="block text-sm font-medium text-foreground">
                    Full name <span className="text-primary" aria-hidden="true">*</span>
                  </label>
                  <input
                    {...register("name")}
                    id="name"
                    type="text"
                    autoComplete="name"
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted"
                    disabled={isSubmitting}
                    aria-invalid={errors.name ? "true" : "false"}
                    aria-describedby={errors.name ? "name-error" : undefined}
                  />
                  {errors.name && (
                    <p id="name-error" className="mt-1.5 text-sm text-destructive" role="alert">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-foreground">
                    Phone number <span className="text-primary" aria-hidden="true">*</span>
                  </label>
                  <div className="relative mt-1.5">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-medium text-muted"
                    >
                      {KENYAN_PHONE_PREFIX}
                    </span>
                    <Controller
                      control={control}
                      name="phone"
                      render={({ field }) => (
                        <input
                          ref={field.ref}
                          name={field.name}
                          value={field.value}
                          onBlur={field.onBlur}
                          onChange={(event) =>
                            field.onChange(
                              kenyanPhoneLocalDigits(event.target.value),
                            )
                          }
                          id="phone"
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          placeholder="712345678"
                          /* No `maxLength={9}`: pasting `0712345678` or
                             `+254712345678` is longer than nine characters,
                             and the browser would truncate it before the
                             handler above could strip the prefix. The handler
                             is what caps the stored value at nine digits. */
                          className="w-full rounded-lg border border-border bg-background py-3 pr-4 pl-[4.6rem] text-sm tabular-nums tracking-wide focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted"
                          disabled={isSubmitting}
                          aria-invalid={errors.phone ? "true" : "false"}
                          aria-describedby={
                            errors.phone ? "phone-error" : "phone-hint"
                          }
                        />
                      )}
                    />
                  </div>
                  {errors.phone ? (
                    <p id="phone-error" className="mt-1.5 text-sm text-destructive" role="alert">
                      {errors.phone.message}
                    </p>
                  ) : (
                    <p id="phone-hint" className="mt-1.5 text-sm text-muted">
                      Enter the 9 digits after +254. Pasting 07… or 01… is
                      adjusted automatically. We&apos;ll send order updates here.
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground">
                    Email (optional)
                  </label>
                  <input
                    {...register("email")}
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted"
                    disabled={isSubmitting}
                    aria-invalid={errors.email ? "true" : "false"}
                    aria-describedby={errors.email ? "email-error" : undefined}
                  />
                  {errors.email && (
                    <p id="email-error" className="mt-1.5 text-sm text-destructive" role="alert">
                      {errors.email.message}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Section 2: Delivery */}
            <section className="space-y-4">
              <h2 className="font-sans text-lg font-semibold tracking-wide uppercase text-foreground">
                Delivery
              </h2>

              {shopConfig.checkoutInstructions && <p className="whitespace-pre-line text-sm text-muted">{shopConfig.checkoutInstructions}</p>}
              {shopConfig.preparationTime && <p className="text-sm text-muted">Estimated preparation time · {shopConfig.preparationTime}</p>}
              <div className="grid gap-4" role="radiogroup" aria-label="Delivery method">
                {/* Delivery option */}
                {shopConfig.deliveryEnabled && <label className="relative cursor-pointer">
                  <input
                    {...register("deliveryMethod")}
                    type="radio"
                    value="delivery"
                    className="sr-only"
                    aria-label="Deliver to my address"
                  />
                  <div
                    className={`
                      relative flex items-start gap-3 rounded-xl border-2 p-4 transition-all duration-200
                      ${deliveryMethod === "delivery"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"}
                    `}
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors" aria-hidden="true">
                      {deliveryMethod === "delivery" && (
                        <CheckCircle className="size-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Truck className="size-5 text-accent" aria-hidden="true" />
                        <span className="font-medium text-foreground">Deliver to my address</span>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {subtotal >= shopConfig.freeDeliveryThreshold
                          ? "Free delivery"
                          : formatPrice(selectedZone?.fee ?? shopConfig.deliveryFlatRate)}
                      </p>
                    </div>
                  </div>
                </label>}

                {/* Pickup option */}
                {shopConfig.pickupAvailable && (
                  <label className="relative cursor-pointer">
                    <input
                      {...register("deliveryMethod")}
                      type="radio"
                      value="pickup"
                      className="sr-only"
                      aria-label="Pick up at the shop"
                    />
                    <div
                      className={`
                        relative flex items-start gap-3 rounded-xl border-2 p-4 transition-all duration-200
                        ${deliveryMethod === "pickup"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"}
                      `}
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors" aria-hidden="true">
                        {deliveryMethod === "pickup" && (
                          <CheckCircle className="size-4 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Package className="size-5 text-accent" aria-hidden="true" />
                          <span className="font-medium text-foreground">Pick up at the shop</span>
                        </div>
                        <p className="mt-1 text-sm text-muted">Free — no delivery fee</p>
                      </div>
                    </div>
                  </label>
                )}
              </div>

              {deliveryMethod === "delivery" && shopConfig.deliveryEstimate && (
                <p className="text-sm text-muted">Estimated delivery · {shopConfig.deliveryEstimate}</p>
              )}

              {/* Zone dropdown (only shown when delivery is selected) */}
              {deliveryMethod === "delivery" && zones.length > 0 && (
                <div className="space-y-2">
                  <label htmlFor="deliveryZone" className="block text-sm font-medium text-foreground">
                    Delivery zone <span className="text-primary" aria-hidden="true">*</span>
                  </label>
                  <select
                    id="deliveryZone"
                    value={selectedZoneId}
                    onChange={(e) => setSelectedZoneId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted"
                    disabled={isSubmitting}
                    required
                  >
                    <option value="">Select your delivery zone</option>
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name} — KES {zone.fee.toLocaleString("en-KE")}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-muted">
                    Delivery fee will be calculated based on your zone
                  </p>
                </div>
              )}

              {/* Delivery address (only shown when delivery is selected) */}
              {deliveryMethod === "delivery" && (
                <div className="space-y-2">
                  <label htmlFor="deliveryAddress" className="block text-sm font-medium text-foreground">
                    Delivery address <span className="text-primary" aria-hidden="true">*</span>
                  </label>
                  <textarea
                    {...register("deliveryAddress")}
                    id="deliveryAddress"
                    rows={3}
                    placeholder="Building, street, area, landmark — e.g., Westlands, Riverside Drive, opposite The Mall"
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted"
                    disabled={isSubmitting}
                    aria-invalid={errors.deliveryAddress ? "true" : "false"}
                    aria-describedby={errors.deliveryAddress ? "address-error" : "address-hint"}
                  />
                  {errors.deliveryAddress ? (
                    <p id="address-error" className="text-sm text-destructive" role="alert">
                      {errors.deliveryAddress.message}
                    </p>
                  ) : (
                    <p id="address-hint" className="text-sm text-muted">
                      We&apos;ll share this with our delivery partner
                    </p>
                  )}
                </div>
              )}

              {/* Pickup info (only shown when pickup is selected) */}
              {deliveryMethod === "pickup" && shopConfig.pickupAvailable && (
                <div className="rounded-lg border border-border bg-background/50 p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-1 size-5 shrink-0 text-accent" aria-hidden="true" />
                    <div>
                      <p className="font-medium text-foreground">Pickup location</p>
                      <p className="mt-1 text-sm text-muted">{shopConfig.pickupAddress || shopConfig.address}</p>
                      {shopConfig.pickupHours && <p className="mt-1 whitespace-pre-line text-sm text-muted">{shopConfig.pickupHours}</p>}
                      {shopConfig.pickupInstructions && <p className="mt-1 whitespace-pre-line text-sm text-muted">{shopConfig.pickupInstructions}</p>}
                      <p className="mt-2 text-sm text-primary">
                        We&apos;ll notify you when your order is ready for pickup.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Section 3: Notes */}
            <section className="space-y-2">
              <label htmlFor="notes" className="block text-sm font-medium text-foreground">
                Notes (optional)
              </label>
              <textarea
                {...register("notes")}
                id="notes"
                rows={3}
                placeholder="Special instructions, gift note, preferred delivery time..."
                maxLength={500}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted"
                disabled={isSubmitting}
                aria-describedby="notes-hint"
              />
              <p id="notes-hint" className="text-sm text-muted">
                Maximum 500 characters
              </p>
            </section>
          </div>

          {/* Order Summary - sticky on desktop, below form on mobile */}
          <div className="lg:col-span-5">
            <div
              className={`
                space-y-4 rounded-xl border border-border bg-card p-5
                ${/* sticky on desktop */ ""}
              `}
              style={{
                position: "sticky",
                top: "calc(var(--navbar-height, 0px) + 2rem)",
                maxHeight: "calc(100vh - var(--navbar-height, 0px) - 4rem)",
                overflowY: "auto",
              }}
            >
              <h2 className="font-sans text-lg font-semibold tracking-wide uppercase text-foreground">
                Order summary
              </h2>

              {/* Items */}
              <ul className="divide-y divide-border" role="list" aria-label="Order items">
                {items.map((item) => (
                  <li key={cartLineKey(item.productId, item.colorId, item.sizeId)} className="py-3 flex gap-3">
                    {/* Thumbnail */}
                    <div
                      className="size-16 shrink-0 rounded-lg overflow-hidden"
                      style={{
                        backgroundColor: item.colorHex,
                        boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.08)",
                      }}
                      aria-hidden="true"
                    >
                      {item.image && (
                        <Image
                          src={originalProductImageUrl(item.image)}
                          alt=""
                          width={64}
                          height={64}
                          className="size-16 object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{
                            backgroundColor: item.colorHex,
                            boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.12)",
                          }}
                          aria-hidden="true"
                        />
                        {item.colorName}{item.sizeLabel ? ` · ${item.sizeLabel}` : ""}
                        <span className="text-muted/50">×</span>
                        <span className="tabular-nums">{item.quantity}</span>
                      </p>
                    </div>

                    <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                      {formatPrice(Math.round(item.unitPrice) * item.quantity)}
                    </p>
                  </li>
                ))}
              </ul>

              {/* Totals */}
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Subtotal</dt>
                  <dd className="font-medium tabular-nums text-foreground">{formatPrice(beforeDiscount)}</dd>
                </div>

                {discountTotal > 0 && (
                  <div className="flex justify-between text-primary">
                    <dt>Discount</dt>
                    <dd className="font-medium tabular-nums">-{formatPrice(discountTotal)}</dd>
                  </div>
                )}

                <div className="flex justify-between">
                  <dt className="text-muted">Delivery</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {deliveryFee === 0 ? (
                      <span className="text-primary">Free</span>
                    ) : (
                      formatPrice(deliveryFee)
                    )}
                  </dd>
                </div>
              </dl>

              <div className="border-t border-border pt-3">
                <div className="flex justify-between text-lg">
                  <dt className="font-semibold text-foreground">Total</dt>
                  <dd className="font-serif font-bold tabular-nums text-foreground">
                    {formatPrice(total)}
                  </dd>
                </div>
                {shopConfig.taxDisplayNote && <p className="text-right text-xs text-muted">{shopConfig.taxDisplayNote}</p>}
                <p className="mt-2 text-xs text-center text-muted">
                  Your order will be confirmed on the next step.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold tracking-wide text-background transition-colors duration-200 ease-out hover:bg-primary-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:bg-muted/50 disabled:text-background"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Creating order...
                  </>
                ) : (
                  "Continue to payment"
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </main>
  );
}