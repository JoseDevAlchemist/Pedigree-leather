import { redirect } from "next/navigation";

/**
 * /bags now redirects to /category/bags. The category page reads from the
 * admin-managed `categories` table, so a shop owner can rename, reorder, or
 * add categories without a code change.
 */
export default function BagsPage() {
  redirect("/category/bags");
}
