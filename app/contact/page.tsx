import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";

import {
  addressLines,
  displayPhone,
  email,
  mailtoHref,
  phoneHref,
  whatsappUrl,
} from "@/lib/contact";

export const metadata: Metadata = {
  title: "Contact",
};

/**
 * The contact page.
 *
 * Reads every detail from `lib/contact`, which is also what the footer and the
 * floating WhatsApp button read. This page used to say "Phone, WhatsApp and shop
 * hours go here", which was an invitation to type the phone number straight into
 * the markup — and then the footer, added later with the same number, would have
 * been free to disagree with it.
 *
 * Hours are not invented here. The workshop's hours are a fact we do not have
 * yet, and a made-up "Mon–Sat, 9am–6pm" on a real shop's contact page is worse
 * than an honest gap: somebody will turn up on the wrong day.
 */
export default function ContactPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 md:px-8">
      <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground">
        Contact
      </h1>
      <p className="mt-4 max-w-md text-pretty text-muted">
        The workshop is in Nairobi. Call, email or message us on WhatsApp and we
        will get back to you.
      </p>

      <div className="mt-10 grid max-w-3xl gap-8 sm:grid-cols-2">
        <div>
          <h2 className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted uppercase">
            Reach us
          </h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <a
                href={phoneHref}
                className="group flex items-center gap-2.5 text-foreground transition-colors duration-200 ease-out hover:text-primary focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Phone aria-hidden="true" className="size-4 shrink-0 text-primary" />
                {displayPhone}
              </a>
            </li>
            <li>
              <a
                href={mailtoHref}
                className="group flex items-center gap-2.5 break-words text-foreground transition-colors duration-200 ease-out hover:text-primary focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Mail aria-hidden="true" className="size-4 shrink-0 text-primary" />
                {email}
              </a>
            </li>
            <li className="flex items-start gap-2.5 text-foreground">
              <MapPin
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-primary"
              />
              <span>
                {addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
            </li>
          </ul>

          <a
            href={whatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-whatsapp px-5 py-2.5 text-sm font-semibold text-charcoal transition-colors duration-200 ease-out hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <MessageCircle aria-hidden="true" className="size-4" />
            Chat on WhatsApp
          </a>
        </div>

        <div>
          <h2 className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted uppercase">
            Ask about
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-pretty text-muted">
            Custom sizing, repairs, or a leather you would like us to stock — all
            welcome. Shoes are in the workshop and new arrivals go up monthly.
          </p>
          <Link
            href="/bags"
            className="mt-4 inline-flex text-sm font-semibold text-primary underline underline-offset-4 transition-colors duration-200 ease-out hover:text-primary-deep focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Browse the bags
          </Link>
        </div>
      </div>
    </main>
  );
}
