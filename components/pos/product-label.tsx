"use client";

type ProductLabelProps = {
  code: string;
  name: string;
  colour: string;
  price: string;
};

export function ProductLabel({ code, name, colour, price }: ProductLabelProps) {
  return (
    <main className="mx-auto flex flex-col items-center gap-4 p-6 print:m-0 print:block print:p-0">
      <style>{`@page { size: 2.625in 1in; margin: 0; }`}</style>
      <article
        aria-label="Product label"
        className="flex min-h-[1in] w-[2.625in] flex-col justify-center gap-[2pt] border border-neutral-300 bg-white px-[8pt] py-[4pt] font-[Arial,sans-serif] leading-none text-black print:break-inside-avoid print:border-transparent"
      >
        <p className={`[overflow-wrap:anywhere] font-bold ${code.length > 28 ? "text-[7pt]" : "text-[12pt]"}`}>
          {code}
        </p>
        <p className="text-[9pt] font-semibold [overflow-wrap:anywhere]">{name}</p>
        <div className="flex items-baseline justify-between gap-[4pt] text-[8pt]">
          <p className="min-w-0 [overflow-wrap:anywhere]">{colour}</p>
          <p className="shrink-0 font-bold whitespace-nowrap tabular-nums">{price}</p>
        </div>
      </article>
      <button
        type="button"
        onClick={() => window.print()}
        className="min-h-11 cursor-pointer rounded-full bg-primary px-5 text-sm font-semibold text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent print:hidden"
      >
        Print label
      </button>
    </main>
  );
}
