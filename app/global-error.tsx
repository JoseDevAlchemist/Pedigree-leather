"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[global-error.tsx] Error caught:", error);

  return (
    <html lang="en">
      <body className="flex min-h-full flex-col">
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 md:px-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Application error
              </h1>
              <p className="mt-2 max-w-md mx-auto text-pretty leading-relaxed text-muted">
                A critical error occurred. Please refresh the page or try again later.
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={reset}
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-primary px-8 text-sm font-semibold tracking-wide text-background transition-colors duration-200 ease-out hover:bg-primary-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
              >
                Refresh page
              </button>
              <Link
                href="/"
                className="inline-flex h-12 w-full items-center justify-center rounded-full border border-primary px-8 text-sm font-semibold text-primary transition-colors duration-200 ease-out hover:bg-primary hover:text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
              >
                Go home
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}