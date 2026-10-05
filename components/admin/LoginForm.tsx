"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { loginAction } from "@/lib/actions/auth";

import { BrandMark, Wordmark } from "@/components/layout/Brand";

/**
 * The admin sign-in form.
 *
 * A client component, because it owns form state and calls a server action. The page
 * that renders it is a Server Component so that it can export `metadata` — see the
 * note there, because getting that the wrong way round takes the whole app down.
 *
 * No navbar, no footer, no WhatsApp button: the route group already keeps them out, and
 * none of them would be wanted here anyway.
 *
 * ---------------------------------------------------------------------------
 * Why this is a server action and not a route handler
 * ---------------------------------------------------------------------------
 * The alternative — posting to an endpoint — would put the password into a request this
 * file then has to parse on the way back, or into a URL bar history entry. A server
 * action keeps the credentials in a POST body, returns a value rather than a
 * redirect, and lets the form show its error in place without going through the router.
 *
 * The password is `autoComplete="current-password"` and the field is
 * `name="password"`, so a password manager can fill it. The autocomplete attributes are
 * not busywork: they are the difference between this form being usable by somebody with
 * forty saved passwords and being unusable.
 *
 * The error is inline and takes focus, so somebody who submitted and got nothing visible
 * does not conclude the form simply did not submit. `aria-live` alone would announce it
 * to a screen reader while leaving a sighted person waiting.
 */
export function LoginForm() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    const result = await loginAction(email, password);

    if (result.ok) {
      /* `replace` so Back does not return to the login form, and `refresh` before the
         navigation lands: the admin layout reads the session, and the dashboard must
         render against a layout that already knows somebody is signed in. Reversing
         these paints the dashboard once with no session and bounces it straight back
         to here. */
      router.replace("/admin");
      router.refresh();
      return;
    }

    setError(result.error);
    setIsSubmitting(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.3, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center text-center">
          <BrandMark />
          <Wordmark className="mt-4 text-xl" />

          <p className="mt-6 font-sans text-xs font-semibold tracking-[0.16em] text-muted uppercase">
            Admin
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 rounded-lg border border-border bg-card px-3 text-sm text-foreground transition-colors duration-150 ease-out placeholder:text-muted/60 focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 rounded-lg border border-border bg-card px-3 text-sm text-foreground transition-colors duration-150 ease-out focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </div>

          {/* `role="alert"` so it is announced the moment it appears, and `tabIndex`
              so it can take focus — a sighted person who pressed Save and watched
              nothing happen needs this to be where their attention already is. */}
          {error ? (
            <p
              role="alert"
              tabIndex={-1}
              className="rounded-lg border border-primary/30 bg-primary/8 px-3 py-2.5 text-sm text-foreground"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 cursor-pointer items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold tracking-wide text-background transition-colors duration-150 ease-out hover:bg-primary-deep active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors duration-150 ease-out hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
            Back to the shop
          </Link>
        </div>
      </motion.div>
    </main>
  );
}