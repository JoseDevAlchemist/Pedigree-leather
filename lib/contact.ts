/**
 * Every way to reach the shop, in one place.
 *
 * The footer prints the phone number, the email and the address; the floating
 * button builds a WhatsApp deep link. That is two components rendering the same
 * three facts, and they were previously free to disagree — which is how a shop
 * ends up with a WhatsApp button that texts a number no longer in service.
 *
 * `wa.me` takes the number in international form with no `+`, no spaces and no
 * punctuation, and `displayPhone` takes the opposite, so both forms are written
 * out here rather than each component formatting the other one's.
 *
 * ---------------------------------------------------------------------------
 * PLACEHOLDERS — REPLACE BEFORE LAUNCH
 * ---------------------------------------------------------------------------
 * `phoneDigits` and `email` are invented. `254700000000` is a well-formed Kenyan
 * number, so it will not fail loudly — it will quietly send real customers to
 * nobody. It is here so the layout can be built and reviewed; swap it for the
 * workshop's line in this file and every consumer updates at once.
 */

export const phoneDigits = "254700000000";

/** How the number is printed. Kenyan convention: +254 then the local number. */
export const displayPhone = "+254 700 000 000";

export const email = "hello@pedigreeleather.co";

/** Workshop address. Shown as written; no map link until there is a map. */
export const addressLines = [
  "Ngong Road, Nairobi",
  "Kenya",
] as const;

/** The sentence WhatsApp opens with. Pre-filled so nobody has to type "hi". */
export const whatsappMessage =
  "Hello Pedigree Leather! I'd like to ask about a bag.";

/**
 * A `wa.me` click-to-chat link with the message already in it.
 *
 * `encodeURIComponent` on the message: it contains an apostrophe and spaces, and
 * an unencoded space inside a query string is what turns a chat link into a 404
 * on half the phones in the country.
 */
export function whatsappUrl(message: string = whatsappMessage): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}

/** A `tel:` href. Same digits as WhatsApp, in the form a dialler understands. */
export const phoneHref = `tel:+${phoneDigits}`;

/** A `mailto:` href. */
export const mailtoHref = `mailto:${email}`;