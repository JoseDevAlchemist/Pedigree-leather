import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";

import { addressLines, displayPhone, email, mailtoHref, phoneHref, whatsappUrl } from "@/lib/contact";
import { NAV_ITEMS } from "@/lib/navigation";

import { BrandMark, Wordmark } from "@/components/layout/Brand";

/**
 * The site footer.
 *
 * Charcoal on the cream page, which inverts the navbar's brown-on-cream. The bar
 * is sticky and travels with the shopper; the footer is the thing at the end of
 * the scroll, so it can afford to be the darkest surface on the site without
 * competing for attention.
 *
 * Three columns from `md` up, stacked below it. The middle and right columns are
 * lists of short lines and the left is a logo and a sentence, so a single
 * `md:grid-cols-3` is enough — no sub-column layout is needed at any width.
 *
 * Everything here is a server component. Nothing in a footer needs state: the
 * nav items come from `lib/navigation` and the contact details from
 * `lib/contact`, both of which the floating WhatsApp button also reads, so the
 * phone number in the footer and the number the button texts are the same number
 * by construction rather than by care.
 *
 * `bg-charcoal` with `text-background` gives cream on a dark ground at 12.6:1,
 * well clear of AA. The column headings step down to `text-background/60` (6.4:1)
 * and the body copy to `/75` — both still comfortably legible, which is the point
 * of using opacity steps of `text-background` rather than reaching for a grey.
 */

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-sans text-[0.6875rem] font-semibold tracking-[0.16em] text-background/60 uppercase">
      {children}
    </h2>
  );
}

/**
 * The gold stitch. The same dashed rule the navbar draws under the active nav
 * item, reused here as a section divider — one brand motif, used twice, rather
 * than a second decorative treatment that would have to be invented.
 */
function StitchRule({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`stitch block h-px w-full text-accent/50 ${className}`}
    />
  );
}

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-charcoal text-background">
      {/* The footer was ~318px tall — about a third of a 900px viewport, which is a
            lot of page for three columns and four links. It is now ~240px. None of
            that came from the type: the logo, headings and links are all the size
            they were, because shrinking text to save space is how a footer starts
            looking like fine print. It came from the padding (`pt-16 pb-8` →
            `pt-7 pb-4`), from folding the WhatsApp button into the contact column so
            it stopped being a row of its own, and from the address going on one
            line above `sm`. The contact column is the tallest of the three and
            therefore sets this height, so it is the one that had to get shorter.

            Mobile stacks the three blocks, which is the one place this is still
            tall — ~580px, because a stacked footer carries three times the
            vertical spacing of a side-by-side one. `gap-8` below `sm` rather than
            a uniform `gap-8` keeps that honest without touching the desktop
            number this trim was actually about. */}
        <div className="mx-auto w-full max-w-6xl px-4 pt-7 pb-4 sm:px-6 lg:px-8">
          <div className="grid gap-7 md:grid-cols-3 md:gap-8">
          {/* Brand */}
          <div>
            <Link
              href="/"
              className="-m-1 flex w-fit items-center gap-3 rounded-full p-1 transition-transform duration-150 ease-out active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              <BrandMark />
              <Wordmark className="text-xl" />
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-pretty text-background/70">
              Luxury leather goods, handcrafted in Nairobi.
            </p>
          </div>

          {/* Quick links */}
          <nav aria-label="Footer">
            <ColumnHeading>Shop</ColumnHeading>
            <ul className="mt-3 space-y-0">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  {item.comingSoon ? (
                    /* Not a link: a shopper who taps "Soon" and lands on an empty
                       page has been told a lie by the nav. */
                    <span className="flex items-center gap-2 py-1 text-sm text-background/45">
                      {item.label}
                      <span className="rounded-full border border-background/20 px-1.5 py-0.5 text-[0.625rem] tracking-wide uppercase">
                        Soon
                      </span>
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      className="inline-block py-1 text-sm text-background/75 transition-colors duration-200 ease-out hover:text-accent focus-visible:rounded focus-visible:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact */}
          <div>
            <ColumnHeading>Contact</ColumnHeading>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li>
                <a
                  href={phoneHref}
                  className="group flex items-start gap-2.5 text-background/75 transition-colors duration-200 ease-out hover:text-accent focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <Phone
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-accent/70 transition-colors duration-200 group-hover:text-accent"
                  />
                  {displayPhone}
                </a>
              </li>
              <li>
                <a
                  href={mailtoHref}
                  className="group flex items-start gap-2.5 break-words text-background/75 transition-colors duration-200 ease-out hover:text-accent focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <Mail
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-accent/70 transition-colors duration-200 group-hover:text-accent"
                  />
                  {email}
                </a>
              </li>
              <li className="flex items-start gap-2.5 text-background/75">
                <MapPin
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-accent/70"
                />
                {/* Comma-joined from `sm` up. The contact column is the tallest
                    of the three and sets the whole footer's height, so the
                    second address line was 20px of the total for no gain — a
                    full column is wide enough for "Ngong Road, Nairobi, Kenya"
                    on one line, and it reads as an address rather than as a
                    list. Stacked below `sm`, where one line would wrap anyway. */}
                <span className="hidden sm:inline">
                  {addressLines.join(", ")}
                </span>
                <span className="sm:hidden">
                  {addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </span>
              </li>
            {/* Last item in the contact column rather than a row of its own. WhatsApp is a
                way to reach the shop, so it belongs with the phone and the email;
                giving it a separate row below all three columns meant it could
                not be trimmed without moving it, and it was most of the extra
                height. */}
              <li>
                <a
                  href={whatsappUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group mt-2 inline-flex items-center gap-2 rounded-full bg-whatsapp px-4 py-1.5 text-sm font-semibold text-charcoal transition-colors duration-200 ease-out hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <MessageCircle aria-hidden="true" className="size-4" />
                  Chat on WhatsApp
                </a>
              </li>
            </ul>
          </div>
          </div>

          <StitchRule className="mt-6" />

          <div className="mt-3 flex flex-col items-start justify-between gap-2 text-xs text-background/55 sm:flex-row sm:items-center">
          <p>© {year} Pedigree Leather. All rights reserved.</p>
          {/* Editable credit line. Kept as literal text rather than pulled from a
              config object: it is prose, it changes when someone decides to
              change it, and there is exactly one of them. */}
          <p>Handmade in Nairobi · Stitched to last</p>
        </div>
      </div>
    </footer>
  );
}