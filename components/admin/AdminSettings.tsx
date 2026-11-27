"use client";

import { useRef, useState, type FormEvent } from "react";
import { useUnsavedSettings } from "@/hooks/useUnsavedSettings";
import { getDisplayPrices } from "@/lib/format";
import { saveSettingsAction } from "@/lib/actions/settings";
import { settingsSections } from "@/lib/settings-sections";
import type { SettingKey, SettingsValues } from "@/lib/settings-schema";

const inputClass = "mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function AdminSettings({ section, initialValues, initialVersion, rateUpdated, brandingBase, stkConfigured, notificationProviders }: {
  section: string;
  initialValues: SettingsValues;
  initialVersion: string | null;
  rateUpdated?: string | null;
  brandingBase?: string;
  stkConfigured?: boolean;
  notificationProviders?: { email: boolean; whatsapp: boolean };
}) {
  const config = settingsSections.find(item => item.id === section)!;
  const [saved, setSaved] = useState(initialValues);
  const [values, setValues] = useState(initialValues);
  const [version, setVersion] = useState(initialVersion);
  const [rateDate, setRateDate] = useState(rateUpdated);
  const [files, setFiles] = useState<Partial<Record<SettingKey, File>>>({});
  const [status, setStatus] = useState<{ error: boolean; message: string }>();
  const [saving, setSaving] = useState(false);
  const [fileRevision, setFileRevision] = useState(0);
  const submitLock = useRef(false);
  const changes = Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== saved[key as SettingKey]));
  const dirty = Object.keys(changes).length > 0 || Object.keys(files).length > 0;

  useUnsavedSettings(dirty, saving);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || submitLock.current || (config.confirm && !window.confirm(`Save changes to ${config.label.toLowerCase()}?`))) return;
    submitLock.current = true;
    setSaving(true);
    setStatus(undefined);
    const uploads = new FormData();
    for (const [key, file] of Object.entries(files)) uploads.set(key, file);
    try {
      const result = await saveSettingsAction(section, version, changes, uploads);
      if (!result.ok) {
        setStatus({ error: true, message: result.error });
        return;
      }
      const next = { ...saved, ...result.values };
      setSaved(next);
      setValues(next);
      setVersion(result.version);
      if ("exchange_rate_kes_to_usd" in result.values) setRateDate(result.rateUpdated);
      setFiles({});
      setFileRevision(revision => revision + 1);
      setStatus({ error: false, message: "Changes saved." });
    } catch {
      setStatus({ error: true, message: "The save could not be confirmed. Reload to check the current values." });
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} aria-busy={saving} className="space-y-6">
      {config.groups?.map(group => (
        <fieldset key={group.title} disabled={saving} className="min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6">
          <legend className="px-2 font-serif text-xl font-semibold">{group.title}</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            {group.fields.map(([key, label, kind = "text"]) => {
              const value = values[key];
              const update = (next: SettingsValues[SettingKey]) => setValues(current => ({ ...current, [key]: next }));
              if (kind === "image") return (
                <div key={key} className="min-w-0 text-sm">
                  <label htmlFor={key} className="font-semibold">{label}</label>
                  <input key={fileRevision} id={key} type="file" accept="image/png,image/jpeg,image/webp" className={inputClass}
                    onChange={event => {
                      const file = event.target.files?.[0];
                      setFiles(current => {
                        const next = { ...current };
                        if (file) next[key] = file;
                        else delete next[key];
                        return next;
                      });
                    }} />
                  <p className="mt-1 text-xs text-muted">JPEG, PNG or WebP, up to 480 KB each.</p>
                  {!!value && brandingBase && <a className="mr-3 underline" href={`${brandingBase}/${value}`} target="_blank" rel="noreferrer">Current image</a>}
                  {!!value && <button type="button" className="underline" onClick={() => {
                    update(null);
                    const input = document.getElementById(key);
                    if (input instanceof HTMLInputElement) input.value = "";
                    setFiles(current => {
                      const next = { ...current };
                      delete next[key];
                      return next;
                    });
                  }}>Use default</button>}
                </div>
              );
              if (kind === "checkbox") return (
                <label key={key} className="flex items-center gap-3 text-sm font-semibold">
                  <input type="checkbox" checked={value === true} onChange={event => update(event.target.checked)} disabled={!value && (
                    key === "stk_enabled" && !stkConfigured ||
                    key.startsWith("notify_") && !(key === "notify_payment_receipt" ? notificationProviders?.email : notificationProviders?.whatsapp)
                  )} className="size-4 accent-primary" />
                  {label}
                </label>
              );
              const numeric = kind === "number" || kind === "decimal";
              return (
                <label key={key} className={`min-w-0 text-sm font-semibold ${kind === "textarea" ? "sm:col-span-2" : ""}`}>
                  {label}
                  {kind === "sort" ? (
                    <select className={inputClass} value={String(value ?? "newest")} onChange={event => update(event.target.value)}>
                      <option value="newest">Newest</option>
                      <option value="price_asc">Price, low to high</option>
                      <option value="price_desc">Price, high to low</option>
                    </select>
                  ) : kind === "textarea" ? (
                    <textarea className={inputClass} rows={3} value={String(value ?? "")} onChange={event => update(event.target.value || null)} />
                  ) : (
                    <input className={inputClass} type={numeric ? "number" : kind} required={numeric}
                      min={numeric ? 0 : undefined}
                      step={numeric ? (kind === "decimal" ? "any" : 1) : undefined}
                      value={String(value ?? "")}
                      onChange={event => update(event.target.value === "" ? null : numeric ? event.target.valueAsNumber : event.target.value)} />
                  )}
                </label>
              );
            })}
          </div>
          {section === "currency" && group.fields.some(([key]) => key === "exchange_rate_kes_to_usd") && (
            <div className="mt-4 space-y-1 text-sm text-muted">
              <p>KES 10,000 converts to {Number(values.exchange_rate_kes_to_usd) > 0
                ? getDisplayPrices({ basePrice: 10_000, discountPercent: 0, exchangeRate: Number(values.exchange_rate_kes_to_usd) }).usd
                : "—"}.</p>
              <p>Rate last changed {rateDate ? `on ${new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(rateDate))} EAT` : "at an unrecorded time"}.</p>
            </div>
          )}
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!dirty || saving} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button type="button" disabled={!dirty || saving} className="rounded-md border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
          onClick={() => { setValues(saved); setFiles({}); setFileRevision(revision => revision + 1); setStatus(undefined); }}>
          Reset
        </button>
        {dirty && !saving && <span className="text-sm text-muted">Unsaved changes</span>}
      </div>
      {status && <p role={status.error ? "alert" : "status"} className={status.error ? "text-sm text-red-800" : "text-sm text-foreground"}>{status.message}</p>}
    </form>
  );
}
