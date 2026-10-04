import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
};

export default function ContactPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 md:px-8">
      <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground">
        Contact
      </h1>
      <p className="mt-4 max-w-md text-pretty text-muted">
        Phone, WhatsApp and shop hours go here.
      </p>
    </main>
  );
}
