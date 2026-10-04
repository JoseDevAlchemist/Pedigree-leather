import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
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

export const metadata: Metadata = {
  title: {
    default: "Pedigree Leather",
    template: "%s | Pedigree Leather",
  },
  description:
    "Handmade leather bags in Nairobi. Luxury, style and comfort, stitched to last.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${manrope.variable} h-full font-sans antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Both providers live up here so their state survives navigation: the
            drawer must stay mounted across routes, and the image transition has
            to outlive the grid page it starts from. */}
        <SharedImageTransitionProvider>
          <CartDrawerProvider>
            <Navbar />
            {children}
          </CartDrawerProvider>
        </SharedImageTransitionProvider>
      </body>
    </html>
  );
}
