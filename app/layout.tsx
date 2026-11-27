import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";

import { BRAND_STATEMENT } from "@/lib/brand";

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
    default: "Pedigree Leather — Leather Bags, Shoes & Belts",
    template: "%s | Pedigree Leather",
  },
  description:
    BRAND_STATEMENT,
  keywords: ["leather bags", "leather shoes", "Nairobi leather", "Kenya leather products", "totes", "satchels", "weekenders"],
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
    title: "Pedigree Leather — Leather Bags, Shoes & Belts",
    description:
      BRAND_STATEMENT,
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
    title: "Pedigree Leather — Leather Bags, Shoes & Belts",
    description:
      BRAND_STATEMENT,
    images: ["/icon.png"],
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#5D4037",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${manrope.variable} h-full font-sans antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}