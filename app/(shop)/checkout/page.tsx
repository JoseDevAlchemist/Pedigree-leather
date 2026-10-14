"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Truck, MapPin, Package, CheckCircle, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useCartStore, useCartSubtotal } from "@/lib/store/cart";
import { formatPrice } from "@/lib/format";
import { createOrderAction } from "@/lib/actions/orders";
import { toast } from "sonner";

interface ShopConfig {
  shopName: string;
  phone: string;
  whatsapp: string;
  email: string | null;
  address: string;
  googleMapsUrl: string | null;
  deliveryFlatRate: number;
  freeDeliveryThreshold: number;
  pickupAvailable: boolean;
}

interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
  active: boolean;
  sort_order: number;
}

const FALLBACK_CONFIG: ShopConfig = {
  shopName: "Pedigree Leather",
  phone: "+254143354741",
  whatsapp: "254143354741",
  email: "hello@pedigree.co.ke",
  address: "Rosslyn Luxury Mall, Annex 2, Shop RLM 48, Nairobi, Kenya",
  googleMapsUrl: "#",
  deliveryFlatRate: 300,
  freeDeliveryThreshold: 25000,
  pickupAvailable: true,
};

/* ---------------------------------------------------------------------------
   Zod schema (mirrors the server action)
   --------------------------------------------------------------------------- */

const checkoutSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z
    .string()
    .min(10, "Phone number is required")
    .refine((val) => /^(\+254|07|01)\d{8,9}$/.test(val.replace(/\s/g, "")), {
      message: "Enter a valid Kenyan phone number (+254..., 07..., or 01...)",
    }),
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
  const pathname = usePathname();
  const items = useCartStore((state) => state.items);
  const subtotal = useCartSubtotal();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [discountTotal, setDiscountTotal] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [shopConfig, setShopConfig] = useState<ShopConfig>(FALLBACK_CONFIG);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");

  // Reset submitting state when navigation completes (pathname changes away from /checkout)
  useEffect(() => {
    if (pathname !== "/checkout") {
      setIsSubmitting(false);
    }
  }, [pathname]);

  // Redirect if cart is empty
  useEffect(() => {
    setIsMounted(true);
    if (items.length === 0) {
      router.push("/bags");
      toast.info("Your cart is empty. Add something first.");
    }
  }, [items, router]);

  // Fetch shop config and zones on mount
  useEffect(() => {
    async function fetchConfig() {
      try {
        const [configRes, zonesRes] = await Promise.all([
          fetch("/api/shop-config", { cache: "no-store" }),
          fetch("/api/delivery-zones", { cache: "no-store" }),
        ]);
        if (configRes.ok) {
          const config = await configRes.json();
          setShopConfig(config);
        }
        if (zonesRes.ok) {
          const zonesData = await zonesRes.json();
          setZones(zonesData.filter((z: DeliveryZone) => z.active));
        }
      } catch {
        // Use fallbacks
      }
    }
    fetchConfig();
  }, []);

  // Calculate discount total from cart items
  useEffect(() => {
    const discount = items.reduce((sum, item) => {
      return sum + (item.basePrice - item.unitPrice) * item.quantity;
    }, 0);
    setDiscountTotal(discount);
  }, [items]);

  const {
    register,
    handleSubmit,
    watch,
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

  // Calculate delivery fee based on method, subtotal, and selected zone
  useEffect(() => {
    const method = watch("deliveryMethod");
    if (method === "delivery") {
      if (selectedZoneId) {
        const zone = zones.find((z) => z.id === selectedZoneId);
        if (zone) {
          setDeliveryFee(subtotal >= shopConfig.freeDeliveryThreshold ? 0 : zone.fee);
        } else {
          setDeliveryFee(subtotal >= shopConfig.freeDeliveryThreshold ? 0 : shopConfig.deliveryFlatRate);
        }
      } else {
        setDeliveryFee(subtotal >= shopConfig.freeDeliveryThreshold ? 0 : shopConfig.deliveryFlatRate);
      }
    } else {
      setDeliveryFee(0);
    }
  }, [subtotal, watch, selectedZoneId, zones, shopConfig]);

  const total = subtotal - discountTotal + deliveryFee;

  // Custom submit handler that calls preventDefault() synchronously at the top
  const handleCheckoutSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    console.log('[checkout] submit handler fired');
    e.preventDefault(); // MUST be first synchronous line

    if (isSubmitting) {
      console.log('[checkout] already submitting, ignoring');
      return;
    }
    setIsSubmitting(true);

    try {
      // Trigger RHF validation manually
      const data = await new Promise<CheckoutForm | null>((resolve) => {
        handleSubmit((validData) => {
          console.log('[checkout] validation passed, data:', validData);
          resolve(validData);
        })(e as React.FormEvent<HTMLFormElement>);
        
        // If validation fails, handleSubmit doesn't call the callback
        // We need a fallback to detect validation failure
        setTimeout(() => {
          console.log('[checkout] validation timeout - likely failed');
          resolve(null);
        }, 100);
      });

      if (!data) {
        console.log('[checkout] validation failed, not submitting');
        setIsSubmitting(false);
        return;
      }

      // Prepare cart items for the server action
      const cartItemsForServer = items.map((item) => ({
        productId: item.productId,
        slug: item.slug,
        name: item.name,
        colorId: item.colorId,
        colorName: item.colorName,
        colorHex: item.colorHex,
        unitPrice: item.unitPrice,
        basePrice: item.basePrice,
        quantity: item.quantity,
        image: item.image,
      }));

      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("email", data.email || "");
      formData.append("phone", data.phone);
      formData.append("deliveryMethod", data.deliveryMethod);
      formData.append("deliveryAddress", data.deliveryAddress || "");
      formData.append("notes", data.notes || "");
      if (selectedZoneId) {
        const zone = zones.find((z) => z.id === selectedZoneId);
        if (zone) {
          formData.append("zoneId", zone.id);
          formData.append("zoneName", zone.name);
        }
      }
      formData.append("cartItems", JSON.stringify(cartItemsForServer));
      formData.append("subtotal", subtotal.toString());
      formData.append("discountTotal", discountTotal.toString());

      console.log('[checkout] calling createOrderAction');
      const result = await createOrderAction(formData);
      console.log('[checkout] createOrderAction result:', result);

      if (result.ok) {
        console.log('[checkout] about to push to /payment/', result.orderId);
        // Clear cart and redirect to payment page
        useCartStore.getState().clearCart();
        console.log('[checkout] calling router.push');
        router.push(`/payment/${result.orderId}`);
        console.log('[checkout] router.push returned');
        // Fallback for React 19 / Next.js 16 navigation issues:
        // if router.push doesn't navigate within 100ms, force hard navigation
        setTimeout(() => {
          if (window.location.pathname === '/checkout') {
            console.log('[checkout] router.push did not navigate, forcing window.location.href');
            window.location.href = `/payment/${result.orderId}`;
          }
        }, 100);
        toast.success("Order created! Choose your payment method.");
      } else {
        console.log('[checkout] server action returned error:', result.error);
        toast.error(result.error);
      }
    } catch (error) {
      console.error('[checkout] submit error:', error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Checkout
        </h1>
        <p className="mt-2 text-muted">Enter your details and choose how you&apos;d like to receive your order.</p>
      </header>

      <form onSubmit={handleCheckoutSubmit} noValidate className="space-y-8">
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
                  <input
                    {...register("phone")}
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+254 7XX XXX XXX"
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted"
                    disabled={isSubmitting}
                    aria-invalid={errors.phone ? "true" : "false"}
                    aria-describedby={errors.phone ? "phone-error" : "phone-hint"}
                  />
                  {errors.phone ? (
                    <p id="phone-error" className="mt-1.5 text-sm text-destructive" role="alert">
                      {errors.phone.message}
                    </p>
                  ) : (
                    <p id="phone-hint" className="mt-1.5 text-sm text-muted">
                      We&apos;ll WhatsApp you order updates
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

              <div className="grid gap-4" role="radiogroup" aria-label="Delivery method">
                {/* Delivery option */}
                <label className="relative cursor-pointer">
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
                      ${watch("deliveryMethod") === "delivery"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"}
                    `}
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors" aria-hidden="true">
                      {watch("deliveryMethod") === "delivery" && (
                        <CheckCircle className="size-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Truck className="size-5 text-accent" aria-hidden="true" />
                        <span className="font-medium text-foreground">Deliver to my address</span>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {(() => {
                          if (selectedZoneId) {
                            const zone = zones.find((z) => z.id === selectedZoneId);
                            if (zone) return `KES ${zone.fee.toLocaleString("en-KE")}`;
                          }
                          return `KES ${shopConfig.deliveryFlatRate.toLocaleString("en-KE")}`;
                        })()}
                        {subtotal >= shopConfig.freeDeliveryThreshold && (
                          <span className="text-primary font-medium"> (Free over KES {shopConfig.freeDeliveryThreshold.toLocaleString("en-KE")})</span>
                        )}
                      </p>
                    </div>
                  </div>
                </label>

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
                        ${watch("deliveryMethod") === "pickup"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"}
                      `}
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors" aria-hidden="true">
                        {watch("deliveryMethod") === "pickup" && (
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

              {/* Zone dropdown (only shown when delivery is selected) */}
              {watch("deliveryMethod") === "delivery" && zones.length > 0 && (
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
              {watch("deliveryMethod") === "delivery" && (
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
              {watch("deliveryMethod") === "pickup" && shopConfig.pickupAvailable && (
                <div className="rounded-lg border border-border bg-background/50 p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-1 size-5 shrink-0 text-accent" aria-hidden="true" />
                    <div>
                      <p className="font-medium text-foreground">Pickup location</p>
                      <p className="mt-1 text-sm text-muted">{shopConfig.address}</p>
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
                  <li key={`${item.productId}:${item.colorId}`} className="py-3 flex gap-3">
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
                        <img
                          src={item.image}
                          alt=""
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
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
                        {item.colorName}
                        <span className="text-muted/50">×</span>
                        <span className="tabular-nums">{item.quantity}</span>
                      </p>
                    </div>

                    <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                      {formatPrice(item.unitPrice * item.quantity)}
                    </p>
                  </li>
                ))}
              </ul>

              {/* Totals */}
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Subtotal</dt>
                  <dd className="font-medium tabular-nums text-foreground">{formatPrice(subtotal)}</dd>
                </div>

                {discountTotal > 0 && (
                  <div className="flex justify-between text-primary">
                    <dt>Discount</dt>
                    <dd className="font-medium tabular-nums">−{formatPrice(discountTotal)}</dd>
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