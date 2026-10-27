import { redirect } from "next/navigation";

/**
 * /shoes now redirects to /category/shoes. The category page reads from the
 * admin-managed `categories` table, so a shop owner can rename, reorder, or
 * add categories without a code change.
 */
export default function ShoesPage() {
  redirect("/category/shoes");
}
