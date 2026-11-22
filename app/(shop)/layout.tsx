import { CartDrawerProvider } from "@/components/cart/CartDrawerProvider";
import { SharedImageTransitionProvider } from "@/components/motion/SharedImageTransition";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { ContactWidgetWrapper } from "@/components/layout/ContactWidgetWrapper";
import { getCategories, getParentCategories } from "@/lib/categories-api";
import { brandingUrl, getShopSettings, getStorefrontPreferences } from "@/lib/settings-api";
import { ExchangeRateProvider } from "@/components/product/ExchangeRateContext";
import { Toaster } from "sonner";
import type { Metadata } from "next";
import { DEFAULT_USD_EXCHANGE_RATE } from "@/lib/exchange-rate";
import { metadata as defaults } from "@/app/layout";

// POS managers can update the shared rate outside this deployment.
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStorefrontPreferences();
  const title = settings.seo_title;
  const description = settings.seo_description;
  const image = brandingUrl(settings.social);
  const favicon = brandingUrl(settings.favicon);
  return {
    title: title ? { default: title, template: "%s | Pedigree Leather" } : defaults.title,
    description: description || defaults.description,
    robots: settings.allow_indexing === false ? { index: false, follow: false } : defaults.robots,
    openGraph: {
      ...defaults.openGraph,
      title: settings.sharing_title || title || defaults.openGraph?.title,
      description: settings.sharing_description || description || defaults.openGraph?.description,
      images: image ? [image] : defaults.openGraph?.images,
    },
    twitter: {
      card: "summary_large_image",
      title: settings.sharing_title || title || defaults.twitter?.title,
      description: settings.sharing_description || description || defaults.twitter?.description,
      images: image ? [image] : defaults.twitter?.images,
    },
    ...(favicon ? { icons: { icon: favicon, shortcut: favicon, apple: favicon } } : {}),
    ...(settings.search_verification ? { verification: { google: settings.search_verification } } : {}),
  };
}


export default async function ShopLayout({
  children,
}: LayoutProps<"/">) {
  const [categories, parentCategories, settings] = await Promise.all([
    getCategories(),
    getParentCategories(),
    getShopSettings().catch(() => null),
  ]);

  const preferences = settings?.storefront_preferences;
  return (
    <CartDrawerProvider>
      <SharedImageTransitionProvider>
        <ExchangeRateProvider rate={settings?.exchange_rate_kes_to_usd ?? DEFAULT_USD_EXCHANGE_RATE}>
          <Navbar categories={categories} parentCategories={parentCategories}
            brandName={settings?.shop_name} logoUrl={brandingUrl(preferences?.logo)} />
          {preferences?.announcement_enabled && preferences.announcement && (
            <p className="bg-primary px-4 py-2 text-center text-sm text-background">{preferences.announcement}</p>
          )}
          {preferences?.maintenance_message && (
            <p className="border-b border-border bg-card px-4 py-2 text-center text-sm">{preferences.maintenance_message}</p>
          )}
          {children}
        </ExchangeRateProvider>
        {/* Below the page, above nothing. `body` is a flex column and every page's
            `<main>` is `flex-1`, so the footer sits at the bottom of the viewport on
            short pages and below the fold on long ones instead of floating
            mid-page. */}
        <Footer />
        <ContactWidgetWrapper />

        {/* `sonner` is used by the card's quick-add and by checkout. The library
            renders nothing until its `<Toaster />` is mounted, so this is the only
            thing that makes those calls visible. Top-centre keeps it clear of the
            floating WhatsApp/contact button in the bottom-right. */}
        <Toaster position="top-center" closeButton />
      </SharedImageTransitionProvider>
    </CartDrawerProvider>
  );
}
