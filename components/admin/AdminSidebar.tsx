"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  LayoutDashboard,
  LogOut,
  Package,
  ScrollText,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { logoutAction } from "@/lib/actions/auth";

import { BrandMark, Wordmark } from "@/components/layout/Brand";
import { useToast } from "@/components/admin/Toast";

/**
 * The admin's navigation.
 *
 * One component for both layouts — a fixed rail on a desktop, a slide-over drawer on
 * a phone — because they are the same list of links and two copies would drift. The
 * only difference is the `variant` prop, which changes where the panel is anchored
 * and whether it is animated at all.
 *
 * ---------------------------------------------------------------------------
 * Why the drawer is a drawer and not a scaled-down rail
 * ---------------------------------------------------------------------------
 * On a 375px screen a 64px rail leaves 311px for a product table, and a table of
 * thumbnails, names, prices, stock and actions needs more than that. So the phone
 * gets the full 84% and the table gets a deliberate horizontal scroll underneath it.
 * See `ProductTable` for why that scroll is the right answer rather than stacked
 * cards.
 *
 * ---------------------------------------------------------------------------
 * The active link
 * ---------------------------------------------------------------------------
 * Active state is `pathname === href` for the dashboard and `pathname.startsWith(href)`
 * for the rest, so `/admin/products/new` lights up "Products" rather than nothing.
 * That is why `/admin` is compared with equality: `startsWith("/admin")` is true for
 * every admin page, and the dashboard would be permanently highlighted.
 */

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "Products", icon: Package, exact: false },
  { href: "/admin/orders", label: "Orders", icon: ScrollText, exact: false },
  { href: "/admin/settings", label: "Settings", icon: Settings, exact: false },
] as const;

export function AdminSidebar({
  email,
  open,
  onClose,
  triggerRef,
}: {
  email: string | undefined;
  /** Drawer open. Ignored by the desktop rail, which is always visible. */
  open: boolean;
  onClose: () => void;
  /** The button that opened the drawer, so focus can go back to it on close. */
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const toast = useToast();

  const [isSigningOut, setIsSigningOut] = useState(false);

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  /* Escape closes, and focus returns to the trigger. Without the second half a
     keyboard user's focus lands on nothing and Tab starts again from the top of the
     document. */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open, triggerRef]);

  const signOut = useCallback(async () => {
    setIsSigningOut(true);
    const result = await logoutAction();

    if (result.ok) {
      /* `refresh` as well as `push`: the admin layout reads the session, and a push
         alone would render the new route against a cached layout that still believes
         somebody is signed in. */
      router.push("/admin/login");
      router.refresh();
      return;
    }

    setIsSigningOut(false);
    toast.error("Could not sign out", result.error);
  }, [router, toast]);

  const nav = (
    <>
      <div className="flex h-16 shrink-0 items-center gap-3 px-5">
        <BrandMark />
        <Wordmark className="text-lg" />
      </div>

      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="flex flex-col gap-1">
          {LINKS.map((link) => {
            const active = isActive(link.href, link.exact);
            const Icon = link.icon;

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                    active
                      ? "bg-primary/10 text-accent"
                      : "text-background/70 hover:bg-background/5 hover:text-background"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-background/10 p-3">
        {email ? (
          <p className="mb-2 truncate px-3 text-xs text-background/50" title={email}>
            {email}
          </p>
        ) : null}

        <button
          type="button"
          onClick={signOut}
          disabled={isSigningOut}
          className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium text-background/70 transition-colors duration-150 ease-out hover:bg-background/5 hover:text-background focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LogOut size={18} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
          {isSigningOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop rail. `hidden md:flex` rather than a JS media query, so it is in
          the first paint and there is no flash of a page with no navigation. */}
      <aside className="hidden w-64 shrink-0 flex-col bg-charcoal md:flex">
        {nav}
      </aside>

      {/* Phone drawer. */}
      <AnimatePresence>
        {open ? (
          <div key="admin-drawer" className="fixed inset-0 z-60 md:hidden">
            <motion.div
              aria-hidden="true"
              onClick={onClose}
              className="absolute inset-0 bg-charcoal/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
            />

            <motion.div
              id="admin-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="absolute inset-y-0 left-0 flex w-[min(17rem,85vw)] flex-col bg-charcoal"
              initial={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
              animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
              exit={
                reduceMotion
                  ? { opacity: 0, transition: { duration: 0.1 } }
                  : { x: "-100%", transition: { duration: 0.22, ease: "easeOut" } }
              }
              transition={{ type: "spring", duration: 0.4, bounce: 0 }}
            >
              <div className="flex h-16 shrink-0 items-center justify-between gap-3 px-5">
                <span className="flex items-center gap-3">
                  <BrandMark />
                  <Wordmark className="text-lg" />
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    triggerRef.current?.focus();
                  }}
                  aria-label="Close menu"
                  className="-mr-2 flex size-11 cursor-pointer items-center justify-center rounded-full text-background transition-colors duration-150 ease-out hover:bg-background/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <X size={22} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>

              {nav}
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

/**
 * The phone-only menu trigger.
 *
 * Owns no state. It hands the clicked element up through `onOpen` so the layout can
 * put it in a ref, which is what lets the sidebar return focus to it on close. Doing
 * that with a module-level variable would work and would be a bug waiting to happen:
 * two sidebars on one page would share it.
 */
export function AdminMenuTrigger({
  onOpen,
}: {
  onOpen: (trigger: HTMLButtonElement) => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => onOpen(event.currentTarget)}
      aria-label="Open menu"
      className="-ml-1 flex size-11 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors duration-150 ease-out hover:bg-primary/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:hidden"
    >
      <Menu size={22} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

function Menu({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}