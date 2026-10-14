import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";

import { CartDrawerProvider } from "@/components/cart/CartDrawerProvider";
import { SharedImageTransitionProvider } from "@/components/motion/SharedImageTransition";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Pedigree Leather — Handcrafted Bags & Shoes in Nairobi",
    template: "%s | Pedigree Leather",
  },
  description:
    "Premium leather bags and shoes, hand-stitched in our Nairobi workshop. Shop totes, satchels, weekenders, and more.",
  keywords: ["leather bags", "handcrafted shoes", "Nairobi leather", "Kenya leather goods", "totes", "satchels", "weekenders"],
  authors: [{ name: "Pedigree Leather" }],
  creator: "Pedigree Leather",
  publisher: "Pedigree Leather",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_KE",
    url: siteUrl,
    siteName: "Pedigree Leather",
    title: "Pedigree Leather — Handcrafted Bags & Shoes in Nairobi",
    description:
      "Premium leather bags and shoes, hand-stitched in our Nairobi workshop. Shop totes, satchels, weekenders, and more.",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "Pedigree Leather",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pedigree Leather — Handcrafted Bags & Shoes in Nairobi",
    description:
      "Premium leather bags and shoes, hand-stitched in our Nairobi workshop. Shop totes, satchels, weekenders, and more.",
    images: ["/icon.png"],
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#5D4037",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

/**
 * The root layout: `<html>`, `<body>`, and the two providers that must outlive a
 * route change.
 *
 * Deliberately **no chrome** — no navbar, no footer, no floating button. They live
 * in `app/(shop)/layout.tsx` instead, so that `/admin` cannot inherit them. Doing it
 * with a `pathname.startsWith("/admin")` check inside this file would work, and it
 * would also mean every customer-facing component is imported into every admin
 * page's bundle: the cart drawer, the shared image transition, the WhatsApp button,
 * all of it dead weight on a back-of-house surface.
 *
 * A route group gives the split structurally. `(shop)` and `(admin)` do not appear
 * in any URL, so both keep their own layout and neither can reach the other's.
 *
 * Both providers still live *here*, not in the shop layout, and that is not an
 * accident: the cart drawer must stay mounted while a shopper navigates the shop,
 * and the image transition has to outlive the grid page it starts from. Putting
 * them in `(shop)` would remount them on every navigation within the shop and break
 * the card → detail morph.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${manrope.variable} h-full font-sans antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SharedImageTransitionProvider>
          <CartDrawerProvider>{children}</CartDrawerProvider>
        </SharedImageTransitionProvider>
      </body>
    </html>
  );
}