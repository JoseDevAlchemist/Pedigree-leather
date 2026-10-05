import { Database, TriangleAlert } from "lucide-react";

/**
 * What the admin shows when the database is not usable yet.
 *
 * A server component: it takes a sentence and prints it, and it needs nothing from
 * the browser. It lives in `components/admin/` rather than inline in the layout so the
 * layout stays readable, and because when the settings page grows this is half of it.
 *
 * The specific instructions matter more than the diagnosis. Somebody who has just
 * cloned this project, filled in `.env.local`, opened `/admin` and been met by a stack
 * trace is one step from a working shop, and the step is spelled out in
 * `docs/SETUP.md`. "Something went wrong" would leave them there.
 */
export function DatabaseSetupNotice({ problem }: { problem: string | null }) {
  return (
    <div className="mx-auto flex max-w-lg items-start py-6">
      <div>
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <TriangleAlert size={20} strokeWidth={1.75} />
        </span>

        <h2 className="mt-4 font-serif text-xl font-semibold tracking-tight text-foreground">
          The database needs setting up
        </h2>

        <p className="mt-2 text-pretty text-sm leading-relaxed text-muted">
          {problem ?? "The catalogue could not be read."}
        </p>

        <p className="mt-5 text-sm font-medium text-foreground">Three steps:</p>

        <ol className="mt-2 flex list-decimal flex-col gap-2.5 pl-5 text-sm leading-relaxed text-muted">
          <li>
            Run <code className="font-mono text-xs">supabase/migrations/001_initial.sql</code> in
            the Supabase SQL editor.
          </li>
          <li>
            Run <code className="font-mono text-xs">supabase/migrations/002_storage.sql</code>, which
            creates the image bucket and its policies.
          </li>
          <li>
            Run <code className="font-mono text-xs">supabase/seed.sql</code> to load the twelve
            products.
          </li>
        </ol>

        <div className="mt-6 rounded-lg border border-border bg-card px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Database size={15} strokeWidth={1.75} aria-hidden="true" />
            Then reload this page
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            There is nothing else to configure. Every step, including creating your admin user, is
            in{" "}
            <code className="font-mono text-xs">docs/SETUP.md</code>.
          </p>
        </div>
      </div>
    </div>
  );
}