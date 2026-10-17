"use client";

import { useState, FormEvent } from "react";
import { Save, Shield, Package, Settings, CheckCircle, AlertCircle } from "lucide-react";
import { updateShopInfoAction, updateDeliverySettingsAction } from "@/lib/actions/settings";
import { useToast } from "@/components/admin/Toast";

interface ShopSettings {
  shop_name: string;
  phone: string;
  whatsapp: string;
  email: string | null;
  address: string;
  google_maps_url: string | null;
  delivery_flat_rate: number;
  free_delivery_threshold: number;
  pickup_available: boolean;
  instagram_handle: string | null;
  instagram_url: string | null;
}

interface AdminSettingsProps {
  settings: ShopSettings;
}

export function AdminSettings({ settings: initialSettings }: AdminSettingsProps) {
  const toast = useToast();
  const [saving, setSaving] = useState<"info" | "delivery" | false>(false);
  const [infoForm, setInfoForm] = useState({
    shop_name: initialSettings.shop_name,
    phone: initialSettings.phone,
    whatsapp: initialSettings.whatsapp,
    email: initialSettings.email || "",
    address: initialSettings.address,
    google_maps_url: initialSettings.google_maps_url || "",
    instagram_handle: initialSettings.instagram_handle || "",
    instagram_url: initialSettings.instagram_url || "",
  });
  const [deliveryForm, setDeliveryForm] = useState({
    delivery_flat_rate: initialSettings.delivery_flat_rate,
    free_delivery_threshold: initialSettings.free_delivery_threshold,
    pickup_available: initialSettings.pickup_available,
  });

  const handleInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInfoForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleDeliveryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, value, checked } = e.target;
    setDeliveryForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "number" ? Number(value) : value,
    }));
  };

  const handleInfoSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving("info");
    const formData = new FormData(e.currentTarget);
    const result = await updateShopInfoAction(formData);
    setSaving(false);
    if (result.ok) {
      toast.success("Shop info saved");
    } else {
      toast.error("Failed to save", result.error);
    }
  };

  const handleDeliverySubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving("delivery");
    const formData = new FormData(e.currentTarget);
    const result = await updateDeliverySettingsAction(formData);
    setSaving(false);
    if (result.ok) {
      toast.success("Delivery settings saved");
    } else {
      toast.error("Failed to save", result.error);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="text-sm text-muted">
            Configure shop information and delivery settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-amber-500" aria-hidden="true" />
          <span className="text-sm text-muted">Owner only</span>
        </div>
      </div>

      {/* Shop Information Section */}
      <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="shop-info-heading">
        <h2 id="shop-info-heading" className="font-sans text-lg font-semibold tracking-tight text-foreground mb-4">
          Shop Information
        </h2>

        <form onSubmit={handleInfoSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="shop_name" className="block text-sm font-medium text-foreground">
                Shop name <span className="text-primary" aria-hidden="true">*</span>
              </label>
              <input
                type="text"
                id="shop_name"
                name="shop_name"
                value={infoForm.shop_name}
                onChange={handleInfoChange}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-foreground">
                Phone <span className="text-primary" aria-hidden="true">*</span>
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={infoForm.phone}
                onChange={handleInfoChange}
                placeholder="+254 700 000 000"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>

            <div>
              <label htmlFor="whatsapp" className="block text-sm font-medium text-foreground">
                WhatsApp number <span className="text-primary" aria-hidden="true">*</span>
              </label>
              <input
                type="text"
                id="whatsapp"
                name="whatsapp"
                value={infoForm.whatsapp}
                onChange={handleInfoChange}
                placeholder="254700000000"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
              <p className="mt-1 text-xs text-muted">Format: 254XXXXXXXXX (no + or spaces)</p>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={infoForm.email}
                onChange={handleInfoChange}
                placeholder="hello@pedigreeleather.co"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-foreground">
              Address <span className="text-primary" aria-hidden="true">*</span>
            </label>
            <textarea
              id="address"
              name="address"
              rows={3}
              value={infoForm.address}
              onChange={handleInfoChange}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>

          <div>
            <label htmlFor="google_maps_url" className="block text-sm font-medium text-foreground">
              Google Maps URL
            </label>
            <input
              type="url"
              id="google_maps_url"
              name="google_maps_url"
              value={infoForm.google_maps_url}
              onChange={handleInfoChange}
              placeholder="https://maps.google.com/..."
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1 text-xs text-muted">Link for the 'Get directions' button on contact page</p>
          </div>

          <div>
            <label htmlFor="instagram_handle" className="block text-sm font-medium text-foreground">
              Instagram Handle
            </label>
            <input
              type="text"
              id="instagram_handle"
              name="instagram_handle"
              value={infoForm.instagram_handle}
              onChange={handleInfoChange}
              placeholder="@pedigreeleather"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1 text-xs text-muted">Without @ symbol (e.g. pedigreeleather)</p>
          </div>

          <div>
            <label htmlFor="instagram_url" className="block text-sm font-medium text-foreground">
              Instagram URL
            </label>
            <input
              type="url"
              id="instagram_url"
              name="instagram_url"
              value={infoForm.instagram_url}
              onChange={handleInfoChange}
              placeholder="https://instagram.com/pedigreeleather"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1 text-xs text-muted">Full profile URL for the contact widget</p>
          </div>

          <button
            type="submit"
            disabled={saving === "info"}
            className="inline-flex items-center gap-2 h-11 rounded-full bg-primary px-5 text-sm font-semibold tracking-wide text-background transition-colors duration-150 ease-out hover:bg-primary-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:opacity-50"
          >
            {saving === "info" ? (
              <>
                <Save className="size-4 animate-spin" aria-hidden="true" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-4" aria-hidden="true" />
                Save shop info
              </>
            )}
          </button>
        </form>
      </section>

      {/* Delivery Settings Section */}
      <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="delivery-heading">
        <h2 id="delivery-heading" className="font-sans text-lg font-semibold tracking-tight text-foreground mb-4">
          Delivery Settings
        </h2>

        <form onSubmit={handleDeliverySubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="delivery_flat_rate" className="block text-sm font-medium text-foreground">
                Flat rate (KES) <span className="text-primary" aria-hidden="true">*</span>
              </label>
              <input
                type="number"
                id="delivery_flat_rate"
                name="delivery_flat_rate"
                value={deliveryForm.delivery_flat_rate}
                onChange={handleDeliveryChange}
                min="0"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>

            <div>
              <label htmlFor="free_delivery_threshold" className="block text-sm font-medium text-foreground">
                Free delivery threshold (KES) <span className="text-primary" aria-hidden="true">*</span>
              </label>
              <input
                type="number"
                id="free_delivery_threshold"
                name="free_delivery_threshold"
                value={deliveryForm.free_delivery_threshold}
                onChange={handleDeliveryChange}
                min="0"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
              <p className="mt-1 text-xs text-muted">Orders above this amount get free delivery</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="pickup_available"
              name="pickup_available"
              checked={deliveryForm.pickup_available}
              onChange={handleDeliveryChange}
              className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-2 focus:ring-primary/20"
            />
            <label htmlFor="pickup_available" className="font-medium text-foreground cursor-pointer">
              Enable shop pickup
            </label>
          </div>

          <button
            type="submit"
            disabled={saving === "delivery"}
            className="inline-flex items-center gap-2 h-11 rounded-full bg-primary px-5 text-sm font-semibold tracking-wide text-background transition-colors duration-150 ease-out hover:bg-primary-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:opacity-50"
          >
            {saving === "delivery" ? (
              <>
                <Save className="size-4 animate-spin" aria-hidden="true" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-4" aria-hidden="true" />
                Save delivery settings
              </>
            )}
          </button>
        </form>
      </section>

      {/* Zones link */}
      <div className="rounded-xl border border-border bg-card p-5 text-center">
        <Package className="size-12 mx-auto text-muted" aria-hidden="true" />
        <h3 className="mt-3 font-medium text-foreground">Delivery Zones</h3>
        <p className="mt-1 text-sm text-muted">
          Manage delivery zones with different fees for different areas
        </p>
        <a
          href="/admin/settings/zones"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors duration-150 ease-out hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Manage zones
          <Settings className="size-4" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}