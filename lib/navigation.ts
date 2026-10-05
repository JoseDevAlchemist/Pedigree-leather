/**
 * The shop's navigation, once.
 *
 * The navbar and the footer both need this list, and until now each kept its
 * own. That is a duplicated fact with a short half-life: the moment a category
 * launches, the nav is updated and the footer keeps linking to a "Soon" page, or
 * a link is added to the nav and the footer quietly stops offering it.
 *
 * A plain data module rather than a component file, because the navbar is a
 * client component (it tracks scroll and owns the mobile drawer) and importing a
 * client module's exports into a server component drags that boundary along with
 * it. The list has no business being on the client at all until the navbar
 * renders it.
 */

export type NavItem = {
  href: string;
  label: string;
  /**
   * Not buyable yet. Rendered as a disabled item with a quiet "Soon" tag instead
   * of a link, so a shopper is never sent to a page that cannot sell them
   * anything.
   *
   * Currently unused — shoes launched, so `/shoes` is a real grid. It stays
   * because checkout and admin are coming, and both belong in here.
   */
  comingSoon?: boolean;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/bags", label: "Bags" },
  { href: "/shoes", label: "Shoes" },
  { href: "/contact", label: "Contact" },
];