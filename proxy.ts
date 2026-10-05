import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * ============================================================================
 * This file is `proxy.ts`, not `middleware.ts`, and the difference is not a
 * style choice.
 * ============================================================================
 *
 * Next.js 16 renamed the `middleware` file convention to `proxy` and deprecated
 * the old name. A `middleware.ts` left in place is not honoured — the guard below
 * would simply never run, and `/admin` would be reachable by anyone who typed the
 * URL, with no error anywhere to explain why. Next ships a codemod for projects
 * coming from 15 (`npx @next/codemod@canary middleware-to-proxy .`).
 *
 * ---------------------------------------------------------------------------
 * What this does, and what it deliberately does not do
 * ---------------------------------------------------------------------------
 * Two jobs, both cheap:
 *
 * 1. **Refresh the session cookie.** Supabase access tokens are short-lived. The
 *    cookies this reads may be stale on any given request, and reading a stale
 *    token is how a user gets logged out at the worst moment. Calling
 *    `getUser()` revalidates the token with the auth server and writes the fresh
 *    pair back onto the request and the response.
 *
 *    Note `getUser()`, not `getSession()`. `getSession` reads the JWT and trusts
 *    it without checking the signature — fine for a cache lookup, wrong for a
 *    guard, because a forged token would pass it.
 *
 * 2. **Keep unauthenticated visitors out of `/admin`.**
 *
 * What this is not: authorisation. A proxy is the wrong place to decide whether
 * this specific user may edit *this* product — it runs on every request for
 * everyone, including crawlers, and it cannot see a database row. So it is used
 * only for the optimistic check the Supabase docs recommend, and every server
 * action and admin page re-checks the session for itself. If the proxy were the
 * only guard, then turning the guard off would be a one-line change with no
 * second line of defence. Treat it as a redirect, not a lock.
 */

const ADMIN_PREFIX = "/admin";
const LOGIN_PATH = "/admin/login";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        /* Writes land on both the request (so downstream Server Components and
           server actions in this same render see the refreshed token) and the
           response (so the browser stores it). Missing either one is a real bug:
           the first means a Server Component still reads the stale token, the
           second means the refresh is thrown away every request. */
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  /* Verifies the token with the auth server rather than trusting its contents.
     `getSession()` alone would be an unverified check, which is not a check. */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);

  if (!user && isAdminRoute && pathname !== LOGIN_PATH) {
    /* `redirectTo` carries where they were going, so signing in resumes the
       navigation instead of dumping them on the dashboard. */
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    loginUrl.search = "";
    if (pathname !== ADMIN_PREFIX) loginUrl.searchParams.set("next", pathname);

    const redirect = NextResponse.redirect(loginUrl);
    /* Copy the refreshed cookies onto the redirect, or the token refresh this
       request just performed is lost the moment we send it. */
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  /* Already signed in and sitting on the login form. */
  if (user && pathname === LOGIN_PATH) {
    const adminUrl = request.nextUrl.clone();
    adminUrl.pathname = ADMIN_PREFIX;
    adminUrl.search = "";

    const redirect = NextResponse.redirect(adminUrl);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  /* Everything except static assets and image optimisation output, which cannot
     be an admin page and would only add latency. Running on `_next/image` in
     particular would mean a Supabase round trip for every thumbnail. */
  matcher: [
    /*
     * Everything except:
     *  - _next/static  (build output)
     *  - _next/image   (the image optimiser)
     *  - favicon.ico   and any file with an extension (.*\\.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};