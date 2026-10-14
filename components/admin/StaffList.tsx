"use client";

import { useState, FormEvent } from "react";
import { Plus, UserCog, Shield, Trash2, Edit2, Loader2 } from "lucide-react";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";

import { createStaffAction, updateStaffAction, deleteStaffAction, AdminUser } from "@/lib/actions/staff";
import { useToast } from "@/components/admin/Toast";

interface StaffListProps {
  initialStaff: AdminUser[];
}

export function StaffList({ initialStaff }: StaffListProps) {
  const reduceMotion = useReducedMotion();
  const toast = useToast();
  const [staff, setStaff] = useState<AdminUser[]>(initialStaff);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ role: "owner" | "worker"; display_name: string }>({
    role: "worker",
    display_name: "",
  });

  const [addForm, setAddForm] = useState({ email: "", role: "worker" as "owner" | "worker", display_name: "" });
  const [addLoading, setAddLoading] = useState(false);

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAddLoading(true);

    const formData = new FormData();
    formData.append("email", addForm.email);
    formData.append("role", addForm.role);
    if (addForm.display_name) formData.append("display_name", addForm.display_name);

    const result = await createStaffAction(formData);
    setAddLoading(false);

    if (result.ok) {
      toast.success("Staff member added");
      setShowAddDialog(false);
      setAddForm({ email: "", role: "worker", display_name: "" });
      // Refresh staff list
      const res = await fetch("/api/admin/staff", { cache: "no-store" });
      const data = await res.json();
      setStaff(data.staff);
    } else {
      toast.error("Failed to add staff", result.error);
    }
  };

  const handleEdit = async (id: string) => {
    const user = staff.find((s) => s.id === id);
    if (!user) return;

    setEditingId(id);
    setEditData({ role: user.role, display_name: user.display_name || "" });
  };

  const handleSaveEdit = async (id: string) => {
    const formData = new FormData();
    formData.append("id", id);
    formData.append("role", editData.role);
    if (editData.display_name) formData.append("display_name", editData.display_name);

    const result = await updateStaffAction(formData);

    if (result.ok) {
      toast.success("Staff updated");
      setEditingId(null);
      // Refresh
      const res = await fetch("/api/admin/staff", { cache: "no-store" });
      const data = await res.json();
      setStaff(data.staff);
    } else {
      toast.error("Failed to update", result.error);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this staff member?")) return;

    const formData = new FormData();
    formData.append("id", id);

    const result = await deleteStaffAction(formData);

    if (result.ok) {
      toast.success("Staff removed");
      setStaff(staff.filter((s) => s.id !== id));
    } else {
      toast.error("Failed to remove", result.error);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            Staff
          </h1>
          <p className="text-sm text-muted">
            {staff.length} team member{staff.length !== 1 ? "s" : ""}
          </p>
        </div>

        <button
          onClick={() => setShowAddDialog(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-background hover:bg-primary-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          Add staff
        </button>
      </div>

      {/* Staff table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <UserCog className="size-12 text-muted/50" aria-hidden="true" />
            <h2 className="mt-4 font-serif text-lg font-semibold text-foreground">
              No staff members yet
            </h2>
            <p className="mt-2 text-sm text-muted">
              Add the first team member to get started
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" role="table">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-sm text-muted hidden md:table-cell">Added</th>
                  <th className="text-right py-3 px-4 font-medium text-sm text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {staff.map((member) => (
                  <tr key={member.id} className="hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                          {member.display_name
                            ? member.display_name.charAt(0).toUpperCase()
                            : member.email.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-foreground">
                          {member.display_name || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">{member.email}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          member.role === "owner"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {member.role === "owner" ? <Shield size={10} aria-hidden="true" /> : <UserCog size={10} aria-hidden="true" />}
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell text-sm text-muted">
                      {new Date(member.created_at).toLocaleDateString("en-KE", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {editingId === member.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <select
                            value={editData.role}
                            onChange={(e) => setEditData({ ...editData, role: e.target.value as "owner" | "worker" })}
                            className="rounded-lg border border-border bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="worker">Worker</option>
                            <option value="owner">Owner</option>
                          </select>
                          <input
                            type="text"
                            value={editData.display_name}
                            onChange={(e) => setEditData({ ...editData, display_name: e.target.value })}
                            placeholder="Display name"
                            className="rounded-lg border border-border bg-background px-2 py-1 text-sm w-32 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <button
                            onClick={() => handleSaveEdit(member.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-background hover:bg-primary-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            aria-label="Save"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                              <path d="M17 21a2 2 0 0 1-2-2v-10" />
                            </svg>
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-background/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            aria-label="Cancel"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(member.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-background/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            aria-label="Edit"
                          >
                            <Edit2 size={16} strokeWidth={2} aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => handleDelete(member.id)}
                            disabled={member.role === "owner"}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Delete"
                          >
                            <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Staff Dialog */}
      <AnimatePresence>
        {showAddDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setShowAddDialog(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-serif text-lg font-semibold text-foreground mb-4">Add staff member</h3>

              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="staff-email" className="block text-sm font-medium text-foreground">
                    Email <span className="text-primary" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="email"
                    id="staff-email"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    placeholder="staff@example.com"
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="staff-role" className="block text-sm font-medium text-foreground">
                    Role <span className="text-primary" aria-hidden="true">*</span>
                  </label>
                  <select
                    id="staff-role"
                    value={addForm.role}
                    onChange={(e) => setAddForm({ ...addForm, role: e.target.value as "owner" | "worker" })}
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="worker">Worker</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="staff-display-name" className="block text-sm font-medium text-foreground">
                    Display name (optional)
                  </label>
                  <input
                    type="text"
                    id="staff-display-name"
                    value={addForm.display_name}
                    onChange={(e) => setAddForm({ ...addForm, display_name: e.target.value })}
                    placeholder="John Doe"
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddDialog(false)}
                    className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-background/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addLoading || !addForm.email}
                    className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background hover:bg-primary-deep disabled:opacity-50 transition-colors"
                  >
                    {addLoading ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Add staff"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}