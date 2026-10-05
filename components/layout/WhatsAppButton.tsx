"use client";

import { motion, useReducedMotion } from "motion/react";
import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";

import { whatsappUrl } from "@/lib/contact";

/**
 * The floating WhatsApp button.
 *
 * Trigger — a click, or the keyboard. Rules — it is always a link: `wa.me` with
 * the message pre-filled, opening in a new tab so a shopper mid-scroll does not
 * lose their place in the grid. Feedback — scale and shadow on hover, a firmer
 * press on tap, plus the browser's own focus ring. Loops — none. It is a
 * persistent affordance, not an animation, and it never moves on its own.
 *
 * Motion notes, because this is the one place on the site where motion is
 * decoration rather than feedback:
 *
 * - Hover is a scale of 1.05 plus a shadow lift, both ~200ms. Both are compositor
 *   properties; nothing here animates a layout value.
 * - Press is 0.92 over ~90ms. Per the micro-interaction guidance, the press is
 *   faster than the hover: a tap needs to feel answered immediately, and a
 *   spring on a tap reads as bounce on a button that is about to leave the page.
 * - Enter animates in once, 320ms, with a spring. It delays by 600ms so the button
 *   does not compete with the page it is arriving on, and it is skipped entirely
 *   under reduced motion.
 *
 * `z-40` puts it above page content but below the navbar (`z-50`) and the cart
 * drawer (`z-60`) — a chat button that floats over an open drawer is a second
 * thing to dismiss.
 *
 * Hidden on `/admin`. The admin is a back-of-house surface where a customer-facing
 * prompt is noise, and it is checked with `startsWith` rather than equality so it
 * stays hidden on `/admin/orders/123` too.
 */

const ENTER_SPRING = { type: "spring", duration: 0.32, bounce: 0 } as const;

export function WhatsAppButton() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  if (pathname.startsWith("/admin")) return null;

  return (
    <motion.a
      href={whatsappUrl()}
      target="_blank"
      rel="noopener noreferrer"
      className="group fixed right-5 bottom-5 z-40 flex size-14 items-center justify-center rounded-full bg-whatsapp text-charcoal shadow-card-lift focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:right-6 sm:bottom-6"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={ENTER_SPRING}
      /* Scale on hover and on focus-visible only. Tabbing to the button must give
         the same feedback as pointing at it, or the affordance is mouse-only. */
      {...(reduceMotion
        ? {}
        : {
            whileHover: { scale: 1.05 },
            whileTap: { scale: 0.92 },
            whileFocus: { scale: 1.05 },
          })}
    >
      <MessageCircle aria-hidden="true" className="size-7" strokeWidth={1.75} />
      <span className="sr-only">Chat with Pedigree Leather on WhatsApp</span>
    </motion.a>
  );
}