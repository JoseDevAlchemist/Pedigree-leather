import { requireAdminUser } from "@/lib/supabase/guards";
import { listAllCategoriesAction } from "@/lib/actions/categories";
import { CategoriesList } from "@/components/admin/CategoriesList";
import type { Category } from "@/lib/types";
import { notFound } from "next/navigation";

export default async function AdminCategoriesPage() {
  const user = await requireAdminUser();

  if (user.role !== "owner") {
    notFound();
  }

  const result = await listAllCategoriesAction();
  if (!result.ok) {
    return <CategoriesList initialCategories={[]} />;
  }

  return <CategoriesList initialCategories={result.data as Category[]} />;
}
