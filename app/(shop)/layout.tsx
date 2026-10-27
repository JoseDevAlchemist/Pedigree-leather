import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { ContactWidgetWrapper } from "@/components/layout/ContactWidgetWrapper";
import { getCategories } from "@/lib/categories-api";
import type { Category } from "@/lib/types";
import { Toaster } from "sonner";

/**
 * The shop shell — everything a customer sees around the page.
 *
 * A route group, so `(shop)` never appears in a URL: `/`, `/bags`, `/shoes` and
 * `/contact` are exactly where they were. Its only job is to be the one place the
 * navbar, the footer and the floating WhatsApp button are mounted.
 *
 * Splitting this out of the root layout is what keeps `/admin` clean. The
 * alternative — one layout with a `pathname.startsWith("/admin")` branch — imports
 * the cart drawer, the image transition and the WhatsApp button into every admin
 * page, and the admin is exactly where none of those belong.
 *
 * The providers stay in the root layout above this one, because they must survive
 * navigation within the shop. See the note there.
 *
 * `WhatsAppButton` also checks the pathname itself and hides itself on `/admin`.
 * That check is now redundant with the route group and is kept anyway, for one
 * reason: it is the only thing standing between a customer prompt and a future
 * admin page someone adds directly under `app/` instead of under `app/(admin)/`.
 * Two cheap guards beat one that has to be remembered.
 */
export default async function ShopLayout({
  children,
}: LayoutProps<"/">) {
  /* Fetch categories server-side. If the fetch fails (missing migration, DB
     down), we pass nothing and the navbar falls back to its static items — the
     shell never crashes because of a category problem. */
  let categories: readonly Category[] = [];
  try {
    categories = await getCategories();
  } catch (error) {
    console.warn("[pedigree/shop-layout] categories failed to load:", error);
    categories = [];
  }

  return (
    <>
      <Navbar categories={categories} />
      {children}
      {/* Below the page, above nothing. `body` is a flex column and every page's
          `<main>` is `flex-1`, so the footer sits at the bottom of the viewport on
          short pages and below the fold on long ones instead of floating
          mid-page. */}
      <Footer />
      {/* Outside the providers: it needs neither the cart nor the image
          transition, and it must render even if a page above it throws. */}
      <ContactWidgetWrapper />

      {/* `sonner` is used by the card's quick-add and by checkout. The library
          renders nothing until its `<Toaster />` is mounted, so this is the only
          thing that makes those calls visible. Top-centre keeps it clear of the
          floating WhatsApp/contact button in the bottom-right. */}
      <Toaster position="top-center" closeButton />
    </>
  );
}
