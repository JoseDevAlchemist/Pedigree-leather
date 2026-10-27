import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone, Camera } from "lucide-react";

import { getShopConfig } from "@/lib/shop-config";

export const metadata: Metadata = {
  title: "Contact us",
};

export default async function ContactPage() {
  const config = await getShopConfig();

  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 md:px-8">
      <header className="max-w-3xl">
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Contact us
        </h1>
        <p className="mt-4 max-w-md text-pretty text-muted">
          We&apos;re here to help. Reach us through any of the channels below.
        </p>
      </header>

      <section aria-labelledby="channels-heading" className="mt-12">
        <h2 id="channels-heading" className="sr-only">
          Contact channels
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {/* WhatsApp */}
          <article className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-card-lift">
            <div className="flex items-center gap-3">
              <span className="flex shrink-0 size-12 items-center justify-center rounded-lg bg-green-100 text-green-700">
                <MessageCircle aria-hidden="true" className="size-6" strokeWidth={2} />
              </span>
              <div>
                <h3 className="font-semibold text-foreground">WhatsApp</h3>
                <p className="text-sm text-muted">Fastest reply</p>
              </div>
            </div>
            <p className="text-sm text-muted">
              Message us directly on WhatsApp. We typically respond within minutes during business hours.
            </p>
            <a
              href={`https://wa.me/${config.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
            >
              <MessageCircle aria-hidden="true" className="size-4" />
              Chat now
            </a>
          </article>

          {/* Instagram */}
          <article className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-card-lift">
            <div className="flex items-center gap-3">
              <span className="flex shrink-0 size-12 items-center justify-center rounded-lg bg-pink-100 text-pink-700">
                <Camera aria-hidden="true" className="size-6" strokeWidth={2} />
              </span>
              <div>
                <h3 className="font-semibold text-foreground">Instagram</h3>
                <p className="text-sm text-muted">{config.instagramHandle || "@pedigreeleather"}</p>
              </div>
            </div>
            <p className="text-sm text-muted">
              Follow us for new arrivals, behind-the-scenes, and leather care tips.
            </p>
            <a
              href={config.instagramUrl || "https://instagram.com/pedigreeleather"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-pink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600"
            >
              <Camera aria-hidden="true" className="size-4" />
              Open Instagram
            </a>
          </article>

          {/* Phone */}
          <article className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-card-lift">
            <div className="flex items-center gap-3">
              <span className="flex shrink-0 size-12 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Phone aria-hidden="true" className="size-6" strokeWidth={2} />
              </span>
              <div>
                <h3 className="font-semibold text-foreground">Call us</h3>
                <p className="text-sm text-muted">{config.phone}</p>
              </div>
            </div>
            <p className="text-sm text-muted">Mon–Sat, 9am–6pm (EAT)</p>
            <a
              href={`tel:+${config.phone.replace(/\D/g, "")}`}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <Phone aria-hidden="true" className="size-4" />
              Call now
            </a>
          </article>

          {/* Email */}
          <article className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-card-lift">
            <div className="flex items-center gap-3">
              <span className="flex shrink-0 size-12 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Mail aria-hidden="true" className="size-6" strokeWidth={2} />
              </span>
              <div>
                <h3 className="font-semibold text-foreground">Email us</h3>
                <p className="text-sm text-muted">{config.email || "hello@pedigree.co.ke"}</p>
              </div>
            </div>
            <p className="text-sm text-muted">We reply within 24 hours</p>
            <a
              href={`mailto:${config.email || "hello@pedigree.co.ke"}`}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-amber-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
            >
              <Mail aria-hidden="true" className="size-4" />
              Send email
            </a>
          </article>
        </div>
      </section>

      {/* Shop info block */}
      <section aria-labelledby="shop-info-heading" className="mt-16">
        <h2 id="shop-info-heading" className="font-serif text-2xl font-semibold tracking-tight text-foreground">
          Visit our workshop
        </h2>
        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />
              <address className="not-italic text-muted leading-relaxed">
                {config.address}
              </address>
            </div>
            {config.googleMapsUrl && (
              <a
                href={config.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline underline-offset-2 hover:text-primary-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Get directions on Google Maps
                <MapPin aria-hidden="true" className="size-4" />
              </a>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Phone aria-hidden="true" className="size-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium text-foreground">Phone</p>
                <a
                  href={`tel:+${config.phone.replace(/\D/g, "")}`}
                  className="text-muted hover:text-primary transition-colors"
                >
                  {config.phone}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail aria-hidden="true" className="size-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium text-foreground">Email</p>
                <a
                  href={`mailto:${config.email || "hello@pedigree.co.ke"}`}
                  className="text-muted hover:text-primary transition-colors"
                >
                  {config.email || "hello@pedigree.co.ke"}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
