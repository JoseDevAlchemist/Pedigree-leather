import { redirect } from "next/navigation";

/**
 * /admin/categories/[id]/edit renders the same CategoriesList as the index page —
 * the edit form is opened client-side by clicking Edit on a row. Redirect keeps
 * the URL canonical.
 */
export default function EditCategoryPage() {
  redirect("/admin/categories");
}
