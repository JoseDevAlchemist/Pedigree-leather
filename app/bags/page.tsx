import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bags",
};

export default function BagsPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 md:px-8">
      <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground">
        Bags
      </h1>
      <p className="mt-4 max-w-md text-pretty text-muted">
        The shop grid is next. This route exists so the navigation has somewhere to land.
      </p>
    </main>
  );
}
