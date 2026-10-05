"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

/**
 * The admin's error boundary.
 *
 * Note what this does *not* try to do: it does not try to explain a missing database.
 * That was the first version of this file, and it cannot work — a Server Component's
 * error crosses this boundary as an opaque digest, with the PostgREST text left behind on
 * the server, so there is nothing here to match on and every guess would be a guess.
 *
 * The missing-database case is handled where the diagnosis is actually possible: the
 * layout runs `adminDatabaseStatus()` before any page renders and shows
 * `DatabaseSetupNotice` instead of the content area. So by the time something reaches
 * *this* boundary it is a genuine surprise, and the useful thing to say is "unexpected,
 * here is the reference, here is how to retry".
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    /* Server-side detail belongs in the server log. `console.error` in an error
       boundary runs on the client, so this cannot see the PostgREST message that
       caused it — but it does put the digest next to the stack trace there, which is
       enough to correlate the two. */
    console.error("[admin] unhandled error:", error.digest ?? error.message);
  }, [error]);

  /* The Supabase error text that means "no such table", checked here so the common
     cause gets a specific instruction. PostgREST's message is stable enough for this:
     it is the same string the library has used for years, and a miss just means the
     generic advice below, which is still right. */
  const looksLikeMissingSchema =
    /PGRST205|Could not find the table|schema cache|relation .* does not exist/i.test(
      error.message,
    );

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <TriangleAlert size={20} strokeWidth={1.75} />
        </span>

        <h2 className="mt-4 font-serif text-xl font-semibold tracking-tight text-foreground">
          The admin could not load
        </h2>

        {looksLikeMissingSchema ? (
          /* Kept as a fallback for the case where the layout's own check passed and a
             *different* query failed on a missing table — which can happen if the
             migration was applied and then something dropped it. The layout cannot
             * cover that; it only checks once, before the pages. */
          <>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Supabase answered, but there is no <code className="font-mono text-xs">products</code>{" "}
              table. The migration has not been applied to this project.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Run the three migration and seed files in the Supabase SQL editor — the order is in{" "}
              <code className="font-mono text-xs">docs/SETUP.md</code> — then try again.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Something went wrong loading this page. The details are in the server log, next to the
            reference below.
          </p>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold tracking-wide text-background transition-colors duration-150 ease-out hover:bg-primary-deep active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
            Try again
          </button>

          <Link
            href="/admin"
            className="inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors duration-150 ease-out hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Dashboard
          </Link>
        </div>

        {error.digest ? (
          <p className="mt-6 text-xs text-muted">
            Reference: <code className="font-mono">{error.digest}</code>
          </p>
        ) : null}
      </div>
    </div>
  );
}