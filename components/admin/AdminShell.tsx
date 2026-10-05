"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  AdminMenuTrigger,
  AdminSidebar,
} from "@/components/admin/AdminSidebar";

/**
 * The admin frame: drawer state, and the two regions that hold it.
 *
 * Split out of the server layout because everything that needs the pathname — the
 * active link, the page title, and closing the drawer on navigation — is a client
 * concern. `AdminShell` is this file's entire reason for existing.
 *
 * Drawer state lives here rather than inside `AdminSidebar` for one specific reason:
 * the trigger and the panel are siblings, and a keyboard user's focus has to be able
 * to travel from one back to the other. That needs one owner of both.
 *
 * Closing on navigation is not a nicety. Without it, tapping "Products" inside the
 * drawer navigates and leaves the panel covering the page they were trying to read.
 */
export function AdminShell({
  email,
  children,
}: {
  email: string | undefined;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  /* On the login page there is nothing to navigate between, and a drawer that
     survives a failed sign-in is a menu over a form. */
  const isLogin = pathname === "/admin/login";

  /* Close the drawer when the route changes. Done during render rather than in an
     effect: an effect would run *after* the new page had already painted with the
     drawer still covering it, which is one visible frame of exactly the bug this is
     meant to prevent. `lastPath` makes the adjustment idempotent, so it settles in
     the same pass instead of on every render. */
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setDrawerOpen(false);
  }

  /* A phone viewport rotating into a tablet width would otherwise leave the desktop
     rail and the drawer both hidden-or-open in the wrong state. */
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 768px)");
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setDrawerOpen(false);
    };
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, []);

  /* While the drawer is open, the page behind it must not scroll. */
  useEffect(() => {
    if (!drawerOpen) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    /* Reserve the scrollbar so locking it does not shift the page sideways. */
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = "";
    };
  }, [drawerOpen]);

  const title = pageTitle(pathname);

  return (
    <div className="flex min-h-screen bg-background">
      {isLogin ? null : (
        <AdminSidebar
          email={email}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          triggerRef={triggerRef}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {isLogin ? null : (
          <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
            <AdminMenuTrigger onOpen={(trigger) => {
              triggerRef.current = trigger;
              setDrawerOpen(true);
            }} />
            <h1 className="font-serif text-lg font-semibold tracking-tight text-foreground">
              {title}
            </h1>
          </header>
        )}

        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

/**
 * The top bar's heading.
 *
 * Derived from the path rather than passed down, so a new page cannot forget to set
 * its own title and leave the bar claiming to be somewhere else. The `/admin/products/new`
 * case is handled explicitly because the default would label it "Products" — which is
 * true and useless when you are creating something.
 */
function pageTitle(pathname: string): string {
  if (pathname === "/admin") return "Dashboard";
  if (pathname === "/admin/products") return "Products";
  if (pathname === "/admin/products/new") return "New product";
  if (/^\/admin\/products\/[^/]+\/edit$/.test(pathname)) return "Edit product";
  if (pathname === "/admin/orders") return "Orders";
  if (pathname === "/admin/settings") return "Settings";
  return "Admin";
}