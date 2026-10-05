"use client";

import { motion } from "motion/react";
import { Pencil, Star, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { deleteProductAction, updateFieldAction } from "@/lib/actions/products";
import type { AdminProduct } from "@/lib/mappers";
import { formatPrice } from "@/lib/format";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";

/**
 * The product table.
 *
 * A table on every width, including a phone, and the horizontal scroll is
 * deliberate. The alternative — turning each row into a stacked card below `sm` —
 * makes a *list of numbers* into a page of shapes: the columns stop lining up, so
 * comparing two stock counts means reading two differently-positioned numbers and
 * holding them in your head. A scrolling table keeps every value on the same
 * baseline, which is the entire reason this view is a table.
 *
 * ---------------------------------------------------------------------------
 * Inline editing, and why it saves a column at a time
 * ---------------------------------------------------------------------------
 * Stock, discount, featured and active are edited in place and saved through
 * `updateFieldAction`, which writes **one column**. Not "read the product, change the
 * field, write the product back" — that would let a stale row in a tab that has been
 * open for an hour silently revert somebody else's edit to the description.
 *
 * Every save ends in `router.refresh()`. The server component re-reads, so the table
 * shows what the database actually holds rather than what this component believes it
 * holds. The local optimistic value is reverted first, which is why a failed save
 * shows the old number rather than a number that is quietly wrong.
 */

type SortKey = "name" | "category" | "basePrice" | "stockQuantity" | "createdAt";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right"; sortable: boolean }[] = [
  { key: "name", label: "Product", align: "left", sortable: true },
  { key: "category", label: "Type", align: "left", sortable: true },
  { key: "basePrice", label: "Price", align: "right", sortable: true },
  { key: "stockQuantity", label: "Stock", align: "right", sortable: true },
  { key: "createdAt", label: "Added", align: "right", sortable: true },
];

export function ProductTable({ products }: { products: AdminProduct[] }) {
  const router = useRouter();
  const toast = useToast();

  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "createdAt",
    direction: "desc",
  });
  const [pending, setPending] = useState<string | null>(null);
  const [isRefreshing, startTransition] = useTransition();
  const [pendingDelete, setPendingDelete] = useState<AdminProduct | null>(null);

  /**
   * Re-read the rows from the server.
   *
   * Wrapped in a transition on purpose: `router.refresh()` fetches the server
   * components again, and without the transition React would block the row that was
   * just saved until that round trip finished — the cell would sit there looking
   * stuck. With it, `isRefreshing` dims the table by a few percent, the save feels
   * instant, and the new values arrive a moment later.
   */
  const refresh = () => startTransition(() => router.refresh());

  const sorted = useMemo(() => {
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...products].sort((a, b) => {
      switch (sort.key) {
        case "name":
          return a.name.localeCompare(b.name) * factor;
        case "category":
          return (a.category + a.name).localeCompare(b.category + b.name) * factor;
        case "basePrice":
          return (a.basePrice - b.basePrice) * factor;
        case "stockQuantity":
          return (a.stockQuantity - b.stockQuantity) * factor;
        case "createdAt":
          return (Date.parse(a.createdAt) - Date.parse(b.createdAt)) * factor;
        default:
          return 0;
      }
    });
  }, [products, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : /* Clicking a new column sorts ascending, which is what a table of names
             should do. Numbers go ascending too, because the person who wants the
             biggest first will click again. */
          { key, direction: "asc" },
    );
  };

  const saveField = async (
    id: string,
    field: "stock_quantity" | "discount_percent" | "featured" | "active",
    value: number | boolean,
  ) => {
    setPending(`${id}:${field}`);
    const result = await updateFieldAction(id, field, value);

    setPending(null);

    if (!result.ok) {
      toast.error("That change did not save", result.error);
      /* Re-read rather than leave the row showing a value the database refused. */
      refresh();
      return;
    }

    /* No toast on success. The row already shows the new value, the cell stopped
       spinning, and a message saying "saved" for every keystroke committed in a table
       is noise. */
    refresh();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    setPending(pendingDelete.id);
    const result = await deleteProductAction(pendingDelete.id);
    setPending(null);
    setPendingDelete(null);

    if (result.ok) {
      toast.success(`Deleted ${pendingDelete.name}`);
      refresh();
      return;
    }

    toast.error("Could not delete that product", result.error);
  };

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <caption className="sr-only">
            Products. Stock, discount, featured and active can be edited in place.
          </caption>

          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="w-16 px-4 py-3 text-left">
                <span className="sr-only">Thumbnail</span>
              </th>

              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    sort.key === column.key
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className={`px-4 py-3 ${column.align === "right" ? "text-right" : "text-left"}`}
                >
                  {column.sortable ? (
                    <SortButton
                      label={column.label}
                      active={sort.key === column.key}
                      direction={sort.direction}
                      align={column.align}
                      onClick={() => toggleSort(column.key)}
                    />
                  ) : (
                    <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                      {column.label}
                    </span>
                  )}
                </th>
              ))}

              <th scope="col" className="px-4 py-3 text-right">
                <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                  Listed
                </span>
              </th>

              <th scope="col" className="px-4 py-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>

          <tbody className={isRefreshing ? "opacity-60 transition-opacity duration-150" : undefined}>
            {sorted.map((product) => (
              <tr
                key={product.id}
                className="border-b border-border last:border-b-0 transition-colors duration-150 ease-out hover:bg-primary/[0.03]"
              >
                <td className="px-4 py-3">
                  <ProductThumb product={product} />
                </td>

                <th scope="row" className="px-4 py-3 text-left align-middle font-normal">
                  <Link
                    href={`/admin/products/${product.id}/edit`}
                    className="font-medium text-foreground transition-colors duration-150 ease-out hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {product.name}
                  </Link>
                  <span className="mt-0.5 block text-xs text-muted">{product.slug}</span>

                  <span className="mt-1 flex items-center gap-2">
                    <Toggle
                      pressed={product.featured}
                      label={`${product.featured ? "Remove" : "Add"} ${product.name} ${product.featured ? "from" : "to"} featured`}
                      activeIcon={<Star size={11} strokeWidth={2.5} aria-hidden="true" />}
                      onClick={() => saveField(product.id, "featured", !product.featured)}
                      disabled={pending === `${product.id}:featured`}
                      tone="accent"
                    />
                    <span className="text-xs text-muted">featured</span>
                  </span>
                </th>

                <td className="px-4 py-3 align-middle">
                  <span className="text-xs font-medium tracking-wide text-muted uppercase">
                    {product.category}
                  </span>
                </td>

                <td className="px-4 py-3 text-right align-middle tabular-nums">
                  <span className="font-semibold text-foreground">
                    {formatPrice(
                      product.discountPercent > 0
                        ? Math.round(product.basePrice * (1 - product.discountPercent / 100))
                        : product.basePrice,
                    )}
                  </span>

                  <NumberCell
                    field="discount_percent"
                    value={product.discountPercent}
                    suffix="%"
                    pending={pending === `${product.id}:discount_percent`}
                    onSave={(next) => saveField(product.id, "discount_percent", next)}
                  />
                </td>

                <td className="px-4 py-3 text-right align-middle tabular-nums">
                  <NumberCell
                    field="stock_quantity"
                    value={product.stockQuantity}
                    pending={pending === `${product.id}:stock_quantity`}
                    onSave={(next) => saveField(product.id, "stock_quantity", next)}
                    tone={product.stockQuantity === 0 ? "alert" : product.stockQuantity < 5 ? "warn" : undefined}
                  />
                </td>

                <td className="px-4 py-3 text-right align-middle text-xs text-muted tabular-nums">
                  {new Date(product.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>

                <td className="px-4 py-3 text-right align-middle">
                  <span className="flex items-center justify-end gap-1">
                    <Toggle
                      pressed={product.active}
                      label={`${product.active ? "Hide" : "Show"} ${product.name}`}
                      onClick={() => saveField(product.id, "active", !product.active)}
                      disabled={pending === `${product.id}:active`}
                    />
                    <span className="ml-1 text-xs text-muted">{product.active ? "live" : "hidden"}</span>
                  </span>
                </td>

                <td className="px-4 py-3 text-right align-middle">
                  <span className="flex items-center justify-end gap-1">
                    <IconButton href={`/admin/products/${product.id}/edit`} label={`Edit ${product.name}`}>
                      <Pencil size={15} strokeWidth={1.75} aria-hidden="true" />
                    </IconButton>

                    <IconButton
                      label={`Delete ${product.name}`}
                      onClick={() => setPendingDelete(product)}
                      destructive
                    >
                      <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
                    </IconButton>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this product?"
        description="It will be removed from the shop straight away."
        subject={pendingDelete?.name}
        isPending={pending !== null}
      />
    </>
  );
}

/**
 * A cell that becomes an input when clicked.
 *
 * Saves on blur and on Enter, and reverts on Escape. Blur is the important one: a
 * person who clicks a stock number, types `3`, and clicks the next row has saved
 * without ever pressing anything, which is what they meant to do.
 */
function NumberCell({
  field,
  value,
  pending,
  onSave,
  suffix,
  tone,
}: {
  field: "stock_quantity" | "discount_percent";
  value: number;
  pending: boolean;
  onSave: (next: number) => void;
  suffix?: string;
  tone?: "warn" | "alert";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  /* Keep the draft honest when the server value changes underneath — a failed save,
     or another person's edit arriving on refresh. */
  if (!editing && draft !== String(value)) setDraft(String(value));

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    setEditing(false);

    /* `NaN` and no change both mean "leave it alone". Reverting rather than writing
       `0` is important: an empty cell is a mistake, and 0 is a real stock level. */
    if (Number.isNaN(parsed) || parsed === value) return;

    if (field === "discount_percent" && (parsed < 0 || parsed > 99)) {
      setDraft(String(value));
      return;
    }

    if (field === "stock_quantity" && parsed < 0) {
      setDraft(String(value));
      return;
    }

    onSave(parsed);
  };

  if (editing) {
    return (
      <input
        /* `autoFocus` rather than a ref plus effect: the field exists, it should have
           the caret, and there is nothing to wait for. */
        autoFocus
        type="number"
        inputMode="numeric"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setDraft(String(value));
            setEditing(false);
          }
        }}
        aria-label={field === "stock_quantity" ? "Stock quantity" : "Discount percentage"}
        className="w-16 rounded-md border border-primary px-1.5 py-0.5 text-right text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      aria-label={`${value}${suffix ?? ""}. Edit.`}
      className={`-mr-1 inline-flex cursor-pointer items-center justify-end gap-0.5 rounded px-1 py-0.5 tabular-nums transition-colors duration-150 ease-out hover:bg-primary/8 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-50 ${
        tone === "alert"
          ? "font-semibold text-primary"
          : tone === "warn"
            ? "font-semibold text-foreground"
            : "text-muted hover:text-foreground"
      }`}
    >
      {value}
      {suffix}
      {pending ? <span className="sr-only">Saving</span> : null}
    </button>
  );
}

/** A two-state pill. Sits at 24px so it is clickable without being loud. */
function Toggle({
  pressed,
  label,
  onClick,
  disabled,
  activeIcon,
  tone = "neutral",
}: {
  pressed: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  activeIcon?: React.ReactNode;
  tone?: "accent" | "neutral";
}) {
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", duration: 0.25, bounce: 0 }}
      className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 ease-out disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        pressed
          ? tone === "accent"
            ? "bg-accent"
            : "bg-primary"
          : "bg-border"
      }`}
    >
      <motion.span
        /* A spring with no overshoot: a knob that wobbles reads as a loose control.
           `layout` rather than animating `left`, so it is transform-only. */
        layout
        transition={{ type: "spring", duration: 0.28, bounce: 0 }}
        className={`absolute flex size-5 items-center justify-center rounded-full bg-card shadow-sm ${
          pressed ? "right-0.5 text-accent" : "left-0.5 text-muted"
        }`}
      >
        {pressed && activeIcon ? activeIcon : null}
      </motion.span>
    </motion.button>
  );
}

function IconButton({
  href,
  label,
  onClick,
  destructive,
  children,
}: {
  href?: string;
  label: string;
  onClick?: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  const className = `inline-flex size-9 cursor-pointer items-center justify-center rounded-lg transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
    destructive
      ? "text-muted hover:bg-primary/10 hover:text-primary"
      : "text-muted hover:bg-primary/8 hover:text-foreground"
  }`;

  if (href) {
    return (
      <Link href={href} aria-label={label} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={label} className={className}>
      {children}
    </button>
  );
}

function SortButton({
  label,
  active,
  direction,
  align,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  align: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sort by ${label}`}
      className={`inline-flex cursor-pointer items-center gap-1 text-xs font-semibold tracking-wide uppercase transition-colors duration-150 ease-out hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        align === "right" ? "flex-row-reverse" : ""
      } ${active ? "text-foreground" : "text-muted"}`}
    >
      {label}
      {/* The arrow is a real glyph, not a border trick, so it follows the font and
          survives a zoom. Hidden when inactive — a column that has never been sorted
          has no direction to show. */}
      <span aria-hidden="true" className={active ? "opacity-100" : "opacity-0"}>
        {direction === "asc" ? "↑" : "↓"}
      </span>
    </button>
  );
}

/**
 * The row thumbnail.
 *
 * The first colourway's front view, which is the same image the shop's card leads
 * with — so a person scanning this table is looking at the same picture a customer
 * will see. Falls back to a block of the colour's own hex, which is what the shop
 * does when there is no photography, and which is the truth today for all twelve
 * products.
 */
function ProductThumb({ product }: { product: AdminProduct }) {
  const color = product.colors[0];
  const src = color?.images[product.angles[0]];

  if (!color) {
    return <span className="block size-11 rounded-lg bg-border" aria-hidden="true" />;
  }

  if (!src) {
    return (
      <span
        aria-hidden="true"
        className="block size-11 rounded-lg"
        style={{ backgroundColor: color.hex, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.1)" }}
      />
    );
  }

  return (
    <Image
      src={src}
      alt=""
      width={44}
      height={44}
      className="size-11 rounded-lg object-cover"
      style={{ boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.08)" }}
    />
  );
}