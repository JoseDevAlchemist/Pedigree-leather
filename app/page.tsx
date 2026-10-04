import Link from "next/link";

export default function Home() {
  return (
    <main
      id="main"
      className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center"
    >
      <h1 className="max-w-xl font-serif text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
        Welcome to Pedigree Leather
      </h1>

      <p className="mt-5 max-w-md text-pretty text-lg text-muted">
        Handmade leather bags, one colour and one angle at a time.
      </p>

      <Link
        href="/bags"
        className="mt-10 inline-flex min-h-11 items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold tracking-wide text-background transition-colors duration-150 ease-out hover:bg-primary-deep active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        Browse bags
      </Link>
    </main>
  );
}
