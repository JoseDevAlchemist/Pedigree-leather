import Link from "next/link";
import { Banknote, Bell, Brush, ChevronDown, ClipboardList, CreditCard, History, Package, Search, Server, Shield, Store, Truck, Users } from "lucide-react";
import type { Metadata } from "next";

import { LegalPoliciesPanel } from "@/components/admin/LegalPoliciesPanel";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { SettingsMaintenanceAction } from "@/components/admin/SettingsMaintenanceAction";
import { createClient } from "@/lib/supabase/server";
import { brandingBaseUrl, getShopSettings } from "@/lib/settings-api";
import { requireRole } from "@/lib/roles";
import { notificationAvailability, resolveNotificationSettings } from "@/lib/notification-settings";
import { settingsSections } from "@/lib/settings-sections";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminPreferences, inventoryDefaults, publicPreferences, type SettingKey, type SettingValue } from "@/lib/settings-schema";
import { z } from "zod";
import { isStkConfigured } from "@/lib/payments/config";
import { version } from "@/package.json";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };
const icons = [Store, Banknote, CreditCard, Truck, Package, ClipboardList, Bell, Users, Brush, Search, Shield, Server, History];

function environmentStatus(keys: string[]) {
  return keys.every(key => process.env[key]?.trim()) ? "Configuration present. Connection unverified." : "Configuration required.";
}

function PaymentStatus() {
  return (
    <dl className="divide-y divide-border rounded-lg border border-border px-4">
      <div className="py-3"><dt className="font-semibold">M-Pesa STK Push</dt><dd>{isStkConfigured() ? "Configuration present. Connection unverified." : "Configuration required."}</dd></div>
      <div className="py-3"><dt className="font-semibold">Card payments</dt><dd>Production checkout integration required. Webhook configuration alone does not enable card checkout.</dd></div>
    </dl>
  );
}

async function loadAuditHistory() {
  try {
    const { data, error } = await createAdminClient().from("shop_settings_audit")
      .select("id, changed_at, actor, changes").order("id", { ascending: false }).limit(50);
    return error ? null : data;
  } catch {
    return null;
  }
}

async function AuditHistory() {
  const entries = await loadAuditHistory();
  if (!entries) return <p role="alert" className="text-sm text-muted">Audit history is unavailable. Check the settings database migration.</p>;
  if (!entries.length) return <p className="text-sm text-muted">No audited settings changes yet.</p>;
  return (
    <ol className="divide-y divide-border rounded-lg border border-border px-4">
      {entries.map(item => (
        <li key={item.id} className="py-3 text-sm">
          <details>
            <summary className="cursor-pointer break-words font-semibold">{new Date(item.changed_at).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })} EAT · {item.actor}</summary>
            <pre className="mt-2 whitespace-pre-wrap break-all text-xs">{JSON.stringify(item.changes, null, 2)}</pre>
          </details>
        </li>
      ))}
    </ol>
  );
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

const snapshotSchema = z.object({
  shop: z.looseObject({
    updated_at: z.string().nullable(),
    exchange_rate_updated_at: z.string().nullable(),
    storefront_preferences: publicPreferences,
  }),
  private: adminPreferences.nullable(),
});

async function loadSnapshot(owner: string, section: string) {
  try {
    const { data, error } = await createAdminClient().rpc("read_website_settings", {
      p_actor: owner, p_section: section,
    });
    if (error) return null;
    const parsed = snapshotSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export default async function AdminSettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  const owner = await requireRole("owner");
  const { section: requested, policy } = await searchParams;
  const section = settingsSections.find(item => item.id === requested) ?? settingsSections[0];
  const fields = section.groups?.flatMap(group => group.fields) ?? [];
  const [snapshot, health, assurance] = await Promise.all([
    fields.length ? loadSnapshot(owner.email, section.id) : null,
    section.id === "system" ? getShopSettings().catch(() => null) : null,
    section.id === "security" ? sessionAssurance() : null,
  ]);
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

  const categoryLinks = settingsSections.map((item, index) => {
    const Icon = icons[index];
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
          {fields.length > 0 && (settings && values && (!["inventory", "notifications"].includes(section.id) || snapshot.private) ? (
            <AdminSettings key={section.id} section={section.id} initialVersion={settings.updated_at}
              notificationProviders={section.id === "notifications" ? notificationAvailability() : undefined} stkConfigured={section.id === "payments" && isStkConfigured()} rateUpdated={settings.exchange_rate_updated_at} brandingBase={brandingBaseUrl()}
              initialValues={Object.fromEntries(fields.map(([key]) => [key, (values as Partial<Record<SettingKey, SettingValue>>)[key] ?? null]))} />
          ) : <p role="alert" className="text-sm text-red-800">Could not load the store settings. Check the database connection and reload.</p>)}
          {section.id === "orders" && <LegalPoliciesPanel owner={owner.email} policy={policy} />}
          {section.id === "payments" && <PaymentStatus />}
          {section.id === "notifications" && (
            <div className="space-y-2 text-sm text-muted">
              <p>Twilio WhatsApp · {environmentStatus(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"])}</p>
              <p>Resend receipts · {environmentStatus(["RESEND_API_KEY"])}</p>
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
          {section.id === "system" && (
            <div className="space-y-4">
              <dl className="space-y-2 rounded-lg border border-border p-4 text-sm">
                <div><dt className="font-semibold">Supabase settings read</dt><dd>{health ? "Settings row read successfully." : "Settings row could not be verified."}</dd></div>
                <div><dt className="font-semibold">Application version</dt><dd>{version}</dd></div>
                <div><dt className="font-semibold">Deployment</dt><dd>{process.env.VERCEL_DEPLOYMENT_ID ?? "Deployment ID unavailable."}</dd></div>
                <div><dt className="font-semibold">Error reporting</dt><dd>{environmentStatus(["NEXT_PUBLIC_SENTRY_DSN"])}</dd></div>
              </dl>
              <PaymentStatus />
              <SettingsMaintenanceAction task="cache" />
            </div>
          )}
          {section.notes?.map(note => <p key={note} className="text-sm leading-relaxed text-muted">{note}</p>)}
          {section.links?.map(([label, href]) => <Link key={href} className="block w-fit text-sm font-semibold underline underline-offset-4" href={href} prefetch={false}>{label}</Link>)}
        </section>
      </div>
    </div>
  );
}
