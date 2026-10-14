"use client";

import { useState, FormEvent } from "react";
import { Plus, Edit, Trash2, Loader2, Save, X, ChevronUp, ChevronDown } from "lucide-react";
import { createZoneAction, updateZoneAction, deleteZoneAction } from "@/lib/actions/zones";
import { useToast } from "@/components/admin/Toast";

interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
  active: boolean;
  sort_order: number;
  created_at: string;
}

interface AdminZonesProps {
  zones: DeliveryZone[];
}

export function AdminZones({ zones: initialZones }: AdminZonesProps) {
  const toast = useToast();
  const [zones, setZones] = useState<DeliveryZone[]>(initialZones);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    fee: "",
    active: true,
    sort_order: 0,
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "number" ? Number(value) : value,
    }));
  };

  const handleAddClick = () => {
    setFormData({ name: "", fee: "", active: true, sort_order: 0 });
    setShowAddForm(true);
  };

  const handleEditClick = (zone: DeliveryZone) => {
    setFormData({
      name: zone.name,
      fee: zone.fee.toString(),
      active: zone.active,
      sort_order: zone.sort_order,
    });
    setEditingId(zone.id);
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingId(null);
    setFormData({ name: "", fee: "", active: true, sort_order: 0 });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    let result;
    if (editingId) {
      const fd = new FormData();
      fd.append("id", editingId);
      Object.entries(formData).forEach(([key, value]) => fd.append(key, String(value)));
      result = await updateZoneAction(fd);
    } else {
      const fd = new FormData();
      Object.entries(formData).forEach(([key, value]) => fd.append(key, String(value)));
      result = await createZoneAction(fd);
    }

    setSaving(false);

    if (result.ok) {
      toast.success(editingId ? "Zone updated" : "Zone created");
      const updatedZones = await fetch("/api/delivery-zones").then((r) => r.json());
      setZones(updatedZones);
      handleCancel();
    } else {
      toast.error("Failed", result.error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this delivery zone? This action cannot be undone.")) return;

    setDeletingId(id);
    const fd = new FormData();
    fd.append("id", id);
    const result = await deleteZoneAction(fd);
    setDeletingId(null);

    if (result.ok) {
      toast.success("Zone deleted");
      setZones((prev) => prev.filter((z) => z.id !== id));
    } else {
      toast.error("Failed to delete", result.error);
    }
  };

  const moveZone = async (id: string, direction: "up" | "down") => {
    const zone = zones.find((z) => z.id === id);
    if (!zone) return;

    const index = zones.findIndex((z) => z.id === id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= zones.length) return;

    const newSortOrder = zones[targetIndex].sort_order;

    const fd = new FormData();
    fd.append("id", id);
    fd.append("sort_order", String(newSortOrder));
    fd.append("name", zone.name);
    fd.append("fee", String(zone.fee));
    fd.append("active", String(zone.active));

    const result = await updateZoneAction(fd);
    if (result.ok) {
      const updatedZones = await fetch("/api/delivery-zones").then((r) => r.json());
      setZones(updatedZones);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            Delivery Zones
          </h1>
          <p className="text-sm text-muted">
            Manage delivery areas and their fees. Zones are shown in the checkout dropdown.
          </p>
        </div>

        <button
          onClick={handleAddClick}
          className="inline-flex items-center gap-2 h-11 rounded-full bg-primary px-5 text-sm font-semibold tracking-wide text-background transition-colors duration-150 ease-out hover:bg-primary-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          Add zone
        </button>
      </div>

      {/* Zones table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {zones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Loader2 className="size-8 text-muted" aria-hidden="true" />
            </div>
            <h2 className="mt-4 font-medium text-foreground">No delivery zones yet</h2>
            <p className="mt-2 text-sm text-muted">Create your first zone to enable zone-based delivery fees</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full" role="table">
                <thead>
                  <tr className="border-b border-border bg-background/50">
                    <th className="text-left py-3 px-4 font-medium text-sm text-muted">Zone</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-muted">Fee (KES)</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-muted hidden sm:table-cell">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-muted">Sort order</th>
                    <th className="text-right py-3 px-4 font-medium text-sm text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {zones.map((zone) => (
                    <tr key={zone.id} className="hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-medium text-foreground">{zone.name}</p>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-foreground">
                        {zone.fee.toLocaleString("en-KE")}
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            zone.active
                              ? "bg-emerald-500 bg-opacity-10 text-emerald-600 border-emerald-300"
                              : "bg-muted bg-opacity-50 text-muted border-border"
                          } border`}
                        >
                          {zone.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted">{zone.sort_order}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => moveZone(zone.id, "up")}
                            disabled={zone.sort_order === 0}
                            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-background transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Move up"
                          >
                            <ChevronUp size={16} strokeWidth={2} aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => moveZone(zone.id, "down")}
                            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-background transition-colors"
                            aria-label="Move down"
                          >
                            <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => handleEditClick(zone)}
                            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-background transition-colors"
                            aria-label="Edit zone"
                          >
                            <Edit size={16} strokeWidth={2} aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => handleDelete(zone.id)}
                            disabled={deletingId === zone.id}
                            className="p-1.5 rounded-lg text-muted hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30"
                            aria-label="Delete zone"
                          >
                            <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Add/Edit form */}
        {(showAddForm || editingId) && (
          <div className="border-t border-border p-4 bg-background/50">
            <h3 className="font-medium text-foreground mb-4">
              {editingId ? "Edit zone" : "Add new zone"}
            </h3>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-foreground">
                  Zone name <span className="text-primary" aria-hidden="true">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Nairobi CBD"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>

              <div>
                <label htmlFor="fee" className="block text-sm font-medium text-foreground">
                  Fee (KES) <span className="text-primary" aria-hidden="true">*</span>
                </label>
                <input
                  type="number"
                  id="fee"
                  name="fee"
                  value={formData.fee}
                  onChange={handleChange}
                  min="0"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>

              <div>
                <label htmlFor="sort_order" className="block text-sm font-medium text-foreground">
                  Sort order
                </label>
                <input
                  type="number"
                  id="sort_order"
                  name="sort_order"
                  value={formData.sort_order}
                  onChange={handleChange}
                  min="0"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="active"
                    checked={formData.active}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="font-medium text-foreground">Active</span>
                </label>
              </div>

              <div className="sm:col-span-4 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-background bg-opacity-5 transition-colors"
                >
                  <X size={16} strokeWidth={2} aria-hidden="true" />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 h-11 rounded-full bg-primary px-5 text-sm font-semibold tracking-wide text-background transition-colors duration-150 ease-out hover:bg-primary-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" aria-hidden="true" />
                      {editingId ? "Update zone" : "Create zone"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}