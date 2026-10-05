import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";

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
export default function ShopLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Navbar />
      {children}
      {/* Below the page, above nothing. `body` is a flex column and every page's
          `<main>` is `flex-1`, so the footer sits at the bottom of the viewport on
          short pages and below the fold on long ones instead of floating
          mid-page. */}
      <Footer />
      {/* Outside the providers: it needs neither the cart nor the image
          transition, and it must render even if a page above it throws. */}
      <WhatsAppButton />
    </>
  );
}