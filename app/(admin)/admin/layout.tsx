import { AdminShell } from "@/components/admin/AdminShell";
import { DatabaseSetupNotice } from "@/components/admin/DatabaseSetupNotice";
import { ToastProvider } from "@/components/admin/Toast";
import { adminDatabaseStatus } from "@/lib/admin-api";
import { getCurrentAdmin, isAllowedAdmin } from "@/lib/supabase/guards";

/**
 * The admin shell.
 *
 * Sits inside `app/(admin)`, so nothing here can reach the shop's navbar, footer or
 * WhatsApp button — they live in `app/(shop)/layout.tsx` and this tree does not
 * descend from it. That is the structural guarantee, and it is the reason the route
 * group exists rather than a `pathname` check in the root layout.
 *
 * ---------------------------------------------------------------------------
 * Where the session is actually checked, and why not here
 * ---------------------------------------------------------------------------
 * A layout cannot branch on the current path in a server component — there is no
 * `pathname` there, and reading it out of `headers()` would mean trusting a value
 * this project has no reason to trust. So the layout does the two things it *can* do
 * correctly, and every page does the rest:
 *
 *   - **This file**: renders the frame when there is a session, and renders bare
 *     children when there is not, so that `/admin/login` works at all. A layout that
 *     redirected whenever it saw no session would redirect the login page to itself,
 *     forever.
 *   - **Every page**: calls `requireAdmin()` as its first statement, which redirects
 *     when there is no session. That is the check that protects data, and it is
 *     duplicated per page on purpose — a page added without one fails visibly and
 *     immediately rather than rendering an empty shell that looks like a bug.
 *   - **`proxy.ts`**: the cheap optimistic redirect, so a signed-out visitor usually
 *     never reaches this tree at all.
 *
 * Three gates, each doing a different job. `proxy.ts` is the only one that may be
 * removed, and the other two are unaffected when it is.
 *
 * ---------------------------------------------------------------------------
 * The allow-list
 * ---------------------------------------------------------------------------
 * `isAllowedAdmin` is checked here too. It is not redundant with the check in every
 * page: the RLS policy in 001_initial.sql grants *every* authenticated user full
 * access, because the database has no concept of a staff role yet. This layout is the
 * narrowest place that can refuse the whole tree to somebody who is not on the list,
 * and the actions enforce it again for writes.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await getCurrentAdmin();

  /* Signed in, but not on the list. Refused here rather than per page, because it
     applies to the entire tree and there is no reason to render the frame first. */
  if (user && !isAllowedAdmin(user.email)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            Not on the list
          </h1>
          <p className="mt-3 text-pretty leading-relaxed text-muted">
            {user.email} is signed in, but it is not on the admin allow-list. Add it to
            AUTH_EMAILS in .env.local and reload.
          </p>
        </div>
      </div>
    );
  }

  /* No session: render the bare children so the login page can be shown. Every
     other page in this tree calls `requireAdmin()` and redirects on its own. */
  if (!user) return <>{children}</>;

  /* -------------------------------------------------------------------------
     Is the database there at all?

     Checked here rather than in `error.tsx`, and the reason is worth recording: a
     Server Component's error reaches an error boundary as an opaque digest, with the
     PostgREST text ("relation products does not exist") left behind on the server. So
     a boundary *cannot* tell this case from any other, no matter how it is written.

     The layout can, because it runs before any page and can replace the content area
     outright. So the most likely failure of a fresh install — someone has built the
     admin and not yet run the migration — produces one readable panel with the three
     things to do, instead of twelve pages each crashing behind a generic message.
     ------------------------------------------------------------------------- */
  const database = await adminDatabaseStatus();

  return (
    <ToastProvider>
      <AdminShell email={user.email}>
        {database.ready ? children : <DatabaseSetupNotice problem={database.problem} />}
      </AdminShell>
    </ToastProvider>
  );
}