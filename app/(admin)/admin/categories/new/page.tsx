import { redirect } from "next/navigation";

/**
 * /admin/categories/new renders the same CategoriesList as the index page —
 * the "New category" form is opened client-side. Redirect keeps the URL
 * canonical.
 */
export default function NewCategoryPage() {
  redirect("/admin/categories");
}
