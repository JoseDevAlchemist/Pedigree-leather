"use client";

import { useState, type FormEvent } from "react";
import { useUnsavedSettings } from "@/hooks/useUnsavedSettings";
import { Save, Plus } from "lucide-react";
import { saveZoneAction, type DeliveryZone } from "@/lib/actions/zones";

const input = "mt-1.5 w-full rounded-md border border-border bg-background p-2 text-sm focus-visible:outline-2 focus-visible:outline-accent";

export function AdminZones({ zones: initialZones }: { zones: DeliveryZone[] }) {
  const [zones, setZones] = useState(initialZones);
  const [editing, setEditing] = useState<DeliveryZone | null>();
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  useUnsavedSettings(dirty, busy);
  const [status, setStatus] = useState<{ error: boolean; message: string }>();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!window.confirm(editing ? "Update this delivery zone and its checkout fee?" : "Create this delivery zone?")) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setStatus(undefined);
    try {
      const result = await saveZoneAction({
        name: form.get("name"),
        fee: Number(form.get("fee")),
        sort_order: Number(form.get("sort_order")),
        active: form.has("active"),
      }, editing ? { id: editing.id, updated_at: editing.updated_at } : null);
      if (!result.ok) {
        setStatus({ error: true, message: result.error });
        return;
      }
      setZones(current => [...current.filter(zone => zone.id !== result.zone.id), result.zone]
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)));
      setEditing(undefined);
      setDirty(false);
      setStatus({ error: false, message: "Delivery zone saved." });
    } catch {
      setStatus({ error: true, message: "Could not confirm the save. Reload to check the current delivery zones." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Delivery zones</h1>
          <p className="mt-1 text-sm text-muted">Active zones and fees appear at website checkout.</p>
        </div>
        <button type="button" disabled={editing !== undefined} onClick={() => { setStatus(undefined); setEditing(null); }}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          <Plus size={16} aria-hidden="true" /> Add zone
        </button>
      </header>
      {editing !== undefined && (
        <form key={editing?.id ?? "new"} onSubmit={save} onChange={() => setDirty(true)} aria-busy={busy}>
          <fieldset disabled={busy} className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
            <legend className="px-2 font-serif text-xl font-semibold">{editing ? `Edit ${editing.name}` : "New delivery zone"}</legend>
            <label className="text-sm font-semibold">Name<input name="name" className={input} maxLength={100} required defaultValue={editing?.name} /></label>
            <label className="text-sm font-semibold">Fee (KES)<input name="fee" className={input} type="number" min={0} max={100000000} required defaultValue={editing?.fee ?? 0} /></label>
            <label className="text-sm font-semibold">Sort order<input name="sort_order" className={input} type="number" min={0} max={100000} required defaultValue={editing?.sort_order ?? (zones.at(-1)?.sort_order ?? 0) + 1} /></label>
            <label className="flex items-center gap-2 text-sm font-semibold"><input name="active" type="checkbox" defaultChecked={editing?.active ?? true} /> Available at checkout</label>
            <div className="flex gap-3 sm:col-span-2">
              <button type="submit" className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">
                <Save size={16} aria-hidden="true" /> {busy ? "Saving…" : "Save zone"}
              </button>
              <button type="button" className="rounded-md border border-border px-4 py-2 text-sm font-semibold" onClick={() => { setEditing(undefined); setDirty(false); setStatus(undefined); }}>Cancel</button>
            </div>
          </fieldset>
        </form>
      )}
      {status && <p role={status.error ? "alert" : "status"} className={status.error ? "text-sm text-destructive" : "text-sm"}>{status.message}</p>}
      {zones.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card px-4">
          {zones.map(zone => (
            <li key={zone.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="break-words font-semibold">{zone.name}</p>
                <p className="text-muted">KES {zone.fee.toLocaleString("en-KE")} · {zone.active ? "Active" : "Inactive"} · Position {zone.sort_order}</p>
              </div>
              <button type="button" disabled={editing !== undefined} aria-label={`Edit ${zone.name}`}
                className="rounded-md border border-border px-3 py-1.5 font-semibold disabled:opacity-50"
                onClick={() => { setStatus(undefined); setEditing(zone); }}>Edit</button>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted">There are no delivery zones. Checkout uses the default delivery fee.</p>}
    </div>
  );
}
