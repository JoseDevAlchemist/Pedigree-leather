import Link from "next/link";
import { Banknote, Bell, ChevronDown, CreditCard, FileText, History, Package, Shield, Store, Truck } from "lucide-react";
import type { Metadata } from "next";

import { LegalPoliciesPanel } from "@/components/admin/LegalPoliciesPanel";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { SettingsMaintenanceAction } from "@/components/admin/SettingsMaintenanceAction";
import { createClient } from "@/lib/supabase/server";
import { brandingBaseUrl } from "@/lib/settings-api";
import { requireRole } from "@/lib/roles";
import { notificationAvailability, resolveNotificationSettings } from "@/lib/notification-settings";
import { settingsSections } from "@/lib/settings-sections";
import { createAdminClient } from "@/lib/supabase/admin";
import { inventoryDefaults, type SettingKey, type SettingValue } from "@/lib/settings-schema";
import { loadAdminSettingsSnapshot } from "@/lib/admin-settings-snapshot";
import { isStkConfigured } from "@/lib/payments/config";
import { getLegalPage } from "@/content/legal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };
const icons = {
  store: Store,
  currency: Banknote,
  payments: CreditCard,
  delivery: Truck,
  inventory: Package,
  notifications: Bell,
  security: Shield,
  audit: History,
  legal: FileText,
};

function PaymentStatus({ stkEnabled, deliveryPayment, pickupPayment }: {
  stkEnabled?: boolean;
  deliveryPayment?: boolean;
  pickupPayment?: boolean;
}) {
  const status = (enabled?: boolean) => enabled === undefined ? "Settings unavailable" : enabled ? "Available" : "Off";
  return (
    <dl className="divide-y divide-border rounded-lg border border-border px-4">
      <div className="py-3"><dt className="font-semibold">M-Pesa STK Push</dt><dd>{isStkConfigured() ? status(stkEnabled) : "Configuration required"}</dd></div>
      <div className="py-3"><dt className="font-semibold">Manual M-Pesa</dt><dd>Available</dd></div>
      <div className="py-3"><dt className="font-semibold">Payment on delivery</dt><dd>{status(deliveryPayment)}</dd></div>
      <div className="py-3"><dt className="font-semibold">Payment at pickup</dt><dd>{status(pickupPayment)}</dd></div>
    </dl>
  );
}

async function AuditHistory() {
  const { settings, policies } = await loadAuditHistory();
  if (!settings && !policies) return <p role="alert" className="text-sm text-muted">Audit history is unavailable. Check the settings and legal database dependencies.</p>;

  const entries = [
    ...(settings ?? []).map(item => ({ ...item, key: `settings-${item.id}`, label: "Settings change" })),
    ...(policies ?? []).map(item => ({
      key: `policy-${item.id}`,
      label: getLegalPage(item.slug)?.label ?? item.slug,
      changed_at: item.created_at,
      actor: item.actor,
      changes: { policy: item.slug, action: item.action, revision: item.id },
    })),
  ].sort((a, b) => Date.parse(b.changed_at) - Date.parse(a.changed_at)).slice(0, 50);

  return (
    <>
      {(!settings || !policies) && <p role="alert" className="text-sm text-muted">
        {settings ? "Legal policy history is unavailable." : "Store settings history is unavailable."}
      </p>}
      {entries.length ? (
        <ol className="divide-y divide-border rounded-lg border border-border px-4">
          {entries.map(item => (
            <li key={item.key} className="py-3 text-sm">
              <details>
                <summary className="cursor-pointer break-words font-semibold">{item.label} · {new Date(item.changed_at).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })} EAT · {item.actor}</summary>
                <pre className="mt-2 whitespace-pre-wrap break-all text-xs">{JSON.stringify(item.changes, null, 2)}</pre>
              </details>
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-muted">No audited changes in the available history.</p>}
    </>
  );
}

async function loadAuditHistory() {
  try {
    const db = createAdminClient();
    const [settings, policies] = await Promise.allSettled([
      db.from("shop_settings_audit").select("id, changed_at, actor, changes")
        .order("id", { ascending: false }).limit(50),
      db.from("legal_policy_revisions").select("id, slug, action, actor, created_at")
        .neq("action", "baseline").order("id", { ascending: false }).limit(50),
    ]);
    return {
      settings: settings.status === "fulfilled" && !settings.value.error ? settings.value.data : null,
      policies: policies.status === "fulfilled" && !policies.value.error ? policies.value.data : null,
    };
  } catch {
    return { settings: null, policies: null };
  }
}

async function sessionAssurance() {
  try {
    const client = await createClient();
    const { data } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!data?.currentLevel) return "Session assurance is unavailable.";
    if (data.currentLevel === "aal2") return "The current session was verified with MFA.";
    if (data.nextLevel === "aal2") return "An MFA factor is enrolled for this account.";
    return "No verified MFA factor is enrolled.";
  } catch {
    return "Session assurance is unavailable.";
  }
}

export default async function AdminSettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  const owner = await requireRole("owner");
  const { section: requested, policy } = await searchParams;
  const selected = requested === "orders" && policy !== undefined ? "legal" : requested;
  const section = settingsSections.find(item => item.id === selected) ?? settingsSections[0];
  const fields = section.groups?.flatMap(group => group.fields) ?? [];
  const [snapshotResult, assurance] = await Promise.all([
    fields.length ? loadAdminSettingsSnapshot(owner.email, section.id) : null,
    section.id === "security" ? sessionAssurance() : null,
  ]);
  const snapshot = snapshotResult?.ok ? snapshotResult.data : null;
  const settings = snapshot?.shop;
  const values = settings && {
    ...settings,
    announcement_enabled: false,
    delivery_enabled: true,
    allow_indexing: true,
    stk_enabled: isStkConfigured(),
    stk_wait_seconds: 45,
    pay_at_pickup: true,
    pay_on_delivery: true,
    feature_first: false,
    show_discount_badge: true,
    hide_unavailable: false,
    homepage_sort: "newest",
    ...settings.storefront_preferences,
    ...(section.id === "inventory" && { ...inventoryDefaults, ...snapshot.private }),
    ...(section.id === "notifications" && snapshot.private && resolveNotificationSettings(snapshot.private)),
  };

  const notificationProviders = section.id === "notifications" ? notificationAvailability() : undefined;
  const categoryLinks = settingsSections.filter(item => !item.hidden).map((item) => {
    const Icon = icons[item.id as keyof typeof icons];
    const active = item.id === section.id;
    return (
      <Link key={item.id} href={item.id === "store" ? "/admin/settings" : `/admin/settings?section=${item.id}`}
        prefetch={false} aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-accent ${active ? "bg-primary text-white" : "hover:bg-background"}`}>
        <Icon size={16} aria-hidden="true" />{item.label}
      </Link>
    );
  });

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="border-b border-border pb-5">
        <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Settings</h1>
        <p className="mt-2 text-sm text-muted">Manage your store, checkout and administration.</p>
      </header>
      <div className="grid min-w-0 items-start gap-7 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <details key={section.id} className="rounded-lg border border-border bg-card lg:hidden">
          <summary className="flex cursor-pointer items-center justify-between gap-3 p-3 text-sm font-semibold marker:content-none focus-visible:outline-2 focus-visible:outline-accent">
            <span><span className="sr-only">Settings category. Current selection </span>{section.label}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <nav aria-label="Settings categories" className="flex flex-col gap-1 border-t border-border p-2">{categoryLinks}</nav>
        </details>
        <nav aria-label="Settings categories" className="hidden flex-col gap-1 rounded-lg border border-border bg-card p-2 lg:flex">{categoryLinks}</nav>
        <section aria-labelledby="section-title" className="min-w-0 space-y-5">
          <header>
            <h2 id="section-title" className="font-serif text-2xl font-semibold">{section.label}</h2>
            <p className="mt-1 text-sm text-muted">{section.description}</p>
          </header>
          {snapshotResult?.ok === false && <p role="alert" className="text-sm text-red-800">{snapshotResult.message}</p>}
          {settings && values && (
            <AdminSettings key={section.id} section={section.id} initialVersion={settings.updated_at}
              notificationProviders={notificationProviders} stkConfigured={section.id === "payments" && isStkConfigured()} rateUpdated={settings.exchange_rate_updated_at} brandingBase={brandingBaseUrl()}
              initialValues={Object.fromEntries(fields.map(([key]) => [key, (values as Partial<Record<SettingKey, SettingValue>>)[key] ?? null]))} />
          )}
          {section.id === "legal" && <LegalPoliciesPanel owner={owner.email} policy={policy} />}
          {section.id === "payments" && (
            <PaymentStatus stkEnabled={values?.stk_enabled}
              deliveryPayment={values && values.delivery_enabled && values.pay_on_delivery}
              pickupPayment={values && settings?.pickup_available === true && values.pay_at_pickup} />
          )}
          {notificationProviders && (
            <div className="space-y-2 text-sm text-muted">
              <p>Twilio WhatsApp · {notificationProviders.whatsapp ? "Configured" : "Unavailable"}</p>
              <p>Resend receipts · {notificationProviders.email ? "Configured" : "Unavailable"}</p>
            </div>
          )}
          {section.id === "seo" && <p className="text-sm text-muted">Analytics status requires a connected analytics integration.</p>}
          {section.id === "security" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4 text-sm">
                <p className="font-semibold">Current account session</p>
                <p className="break-all">{owner.email}</p>
                <p className="mt-2 text-muted">{assurance}</p>
              </div>
              <SettingsMaintenanceAction task="sessions" />
            </div>
          )}
          {section.id === "audit" && <AuditHistory />}
          {section.id === "system" && <SettingsMaintenanceAction task="cache" />}
          {section.notes?.map(note => <p key={note} className="text-sm leading-relaxed text-muted">{note}</p>)}
          {section.links?.map(([label, href]) => <Link key={href} className="block w-fit text-sm font-semibold underline underline-offset-4" href={href} prefetch={false}>{label}</Link>)}
        </section>
      </div>
    </div>
  );
}
