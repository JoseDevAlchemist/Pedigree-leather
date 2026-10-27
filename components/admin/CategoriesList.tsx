"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  createCategoryAction,
  deleteCategoryAction,
  listAllCategoriesAction,
  updateCategoryAction,
} from "@/lib/actions/categories";
import { useToast } from "@/components/admin/Toast";
import type { Category } from "@/lib/types";

interface CategoriesListProps {
  initialCategories: Category[];
}

export function CategoriesList({ initialCategories }: CategoriesListProps) {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    parentId: "",
    displayOrder: "0",
    isActive: "true",
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAddClick = () => {
    setFormData({ name: "", slug: "", parentId: "", displayOrder: "0", isActive: "true" });
    setEditingId(null);
  };

  const handleEditClick = (cat: Category) => {
    setFormData({
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId ?? "",
      displayOrder: String(cat.displayOrder),
      isActive: String(cat.isActive),
    });
    setEditingId(cat.id);
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ name: "", slug: "", parentId: "", displayOrder: "0", isActive: "true" });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    /* The action validates a plain object, not a `FormData`. Building the object
       here also converts the two fields that arrive as strings: a checkbox is
       "true"/"false" and display order has to be a number. */
    const payload = {
      name: formData.name,
      slug: formData.slug,
      parentId: formData.parentId || null,
      displayOrder: Number(formData.displayOrder) || 0,
      isActive: formData.isActive === "true",
    };

    let result;
    if (editingId) {
      result = await updateCategoryAction(editingId, payload);
    } else {
      result = await createCategoryAction(payload);
    }

    setSaving(false);

    if (result.ok) {
      toast.success(editingId ? "Category updated" : "Category created");
      const refreshed = await listAllCategoriesAction();
      if (refreshed.ok) {
        setCategories(refreshed.data as Category[]);
      }
      handleCancel();
    } else {
      toast.error("Failed", result.error);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? Products in this category will be unassigned.`)) return;

    setDeletingId(id);
    const result = await deleteCategoryAction(id);
    setDeletingId(null);

    if (result.ok) {
      toast.success("Category deleted");
      const refreshed = await listAllCategoriesAction();
      if (refreshed.ok) {
        setCategories(refreshed.data as Category[]);
      }
    } else {
      toast.error("Cannot delete", result.error);
    }
  };

  const topLevel = categories.filter((c) => !c.parentId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-serif font-semibold text-foreground">Categories</h2>
          <p className="text-sm text-muted">
            Manage product categories. Shoppers see them in the navbar and at
            /category/[slug].
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddClick}
          disabled={saving}
          className="flex items-center gap-2 rounded-full bg-primary text-background px-4 py-2 text-sm font-semibold hover:bg-primary-deep disabled:opacity-60"
        >
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          New category
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div
          className={`rounded-xl border border-border bg-card p-4 ${
            editingId ? "bg-primary/10" : ""
          }`}
        >
          <h3 className="mb-3 font-serif text-lg font-semibold text-foreground">
            {editingId ? "Edit category" : "New category"}
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="cat-name" className="block text-sm font-medium text-foreground mb-1">
                Name
              </label>
              <input
                id="cat-name"
                name="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="cat-slug" className="block text-sm font-medium text-foreground mb-1">
                Slug
              </label>
              <input
                id="cat-slug"
                name="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                required
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="cat-parent" className="block text-sm font-medium text-foreground mb-1">
                Parent category (optional)
              </label>
              <select
                id="cat-parent"
                name="parentId"
                value={formData.parentId}
                onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">None (top-level)</option>
                {topLevel.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="cat-order" className="block text-sm font-medium text-foreground mb-1">
                Display order
              </label>
              <input
                id="cat-order"
                name="displayOrder"
                type="number"
                value={formData.displayOrder}
                onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="col-span-2 sm:col-span-1 flex items-end">
              <label
                htmlFor="cat-active"
                className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer"
              >
                <input
                  id="cat-active"
                  name="isActive"
                  type="checkbox"
                  checked={formData.isActive === "true"}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: String(e.target.checked) })
                  }
                  className="rounded border-border bg-background text-primary focus:ring-0"
                />
                Active (visible in shop)
              </label>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex h-10 w-full items-center justify-center rounded-full px-6 text-sm font-semibold transition-colors duration-200 ease-out bg-primary text-background hover:bg-primary-deep disabled:opacity-60"
            >
              {saving ? "Saving…" : editingId ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="flex h-10 items-center justify-center rounded-full px-6 text-sm font-semibold transition-colors duration-200 ease-out bg-muted/50 text-background hover:bg-muted/70 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>

      <div className="border-t border-border pt-6">
        <h3 className="mb-4 font-serif text-lg font-semibold text-foreground">
          All categories ({categories.length})
        </h3>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-sm font-semibold text-muted">Name</th>
                <th className="px-4 py-3 text-sm font-semibold text-muted">Slug</th>
                <th className="px-4 py-3 text-sm font-semibold text-muted">Parent</th>
                <th className="px-4 py-3 text-sm font-semibold text-muted">Order</th>
                <th className="px-4 py-3 text-sm font-semibold text-muted">Status</th>
                <th className="px-4 py-3 text-sm font-semibold text-muted text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categories.map((cat) => {
                const parent = categories.find((c) => c.id === cat.parentId);
                return (
                  <tr key={cat.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm text-foreground">
                      {cat.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted font-mono">
                      /category/{cat.slug}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {parent ? parent.name : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {cat.displayOrder}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {cat.isActive ? (
                        <span className="text-xs font-medium text-accent">Active</span>
                      ) : (
                        <span className="text-xs font-medium text-muted">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <button
                        type="button"
                        onClick={() => handleEditClick(cat)}
                        disabled={saving || deletingId === cat.id}
                        className="text-sm font-medium text-accent hover:text-accent-deep disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat.id, cat.name)}
                        disabled={saving || deletingId === cat.id}
                        className="ml-3 text-sm font-medium text-destructive hover:text-destructive disabled:opacity-50"
                      >
                        <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                        <span className="sr-only">Delete {cat.name}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
