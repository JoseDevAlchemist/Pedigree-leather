"use client";

import { motion, useReducedMotion } from "motion/react";
import { ImagePlus, Loader2, Plus, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { createProductAction, updateProductAction } from "@/lib/actions/products";
import { categoryAngles } from "@/lib/angles";
import { uploadProductImage } from "@/lib/upload";
import type { AdminProduct } from "@/lib/mappers";
import type { Angle, Product } from "@/lib/types";
import { productInputSchema } from "@/lib/validation";

import { useToast } from "@/components/admin/Toast";

/**
 * Create and edit a product.
 *
 * One component for both. The two modes differ only in what they submit and what
 * they do afterwards, and splitting them would mean the fields — eight of them,
 * plus a colour editor per colour — exist twice and drift. `mode` decides the action
 * and the redirect; everything else is shared.
 *
 * ---------------------------------------------------------------------------
 * What is client state and what is not
 * ---------------------------------------------------------------------------
 * Colours are **local state**, not fields in one form element. A colour has a name, a
 * hex and up to five uploads, and it needs to be added, removed and reordered as a
 * unit — which a flat `<FormData>` cannot express and which would make the server
 * action's schema depend on the order of an array of arrays.
 *
 * Everything else is a controlled input validated by the shared Zod schema, and the
 * same schema runs again in the action. See `lib/validation.ts` for why it exists
 * twice.
 *
 * ---------------------------------------------------------------------------
 * Uploads are not transactional, and that is deliberate
 * ---------------------------------------------------------------------------
 * A file lands in storage the moment it is chosen, before Save is pressed. So
 * abandoning the form leaves orphaned objects in the bucket. The alternative — holding
 * the file in memory until Save — means a five-photograph form holds five megabytes
 * of `File` for as long as it is open, and the moment a save fails halfway the
 * database and the bucket are further out of step, not less.
 *
 * Orphaned files cost storage and nothing else; they are never referenced, so they
 * cannot appear in the shop. `docs/ADMIN_INTEGRATION_TODO.md` has bucket cleanup as a
 * follow-up, and it is a cron job, not a correctness problem.
 */

type ColorDraft = {
  /** Stable key for React. The database id is unknown for a colour being created. */
  key: string;
  name: string;
  hex: string;
  /** Slot -> public URL. Missing means "no photograph", which is not an error. */
  images: Partial<Record<Angle, string>>;
  /** Slot currently uploading. One at a time, so the grid does not flicker. */
  uploading?: Angle;
  error?: string;
};

export function ProductForm({
  mode,
  initialData,
}: {
  mode: "create" | "edit";
  initialData?: AdminProduct;
}) {
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState(initialData?.name ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  /* The slug is filled from the name until somebody edits it by hand. `slugTouched`
     is the flag that stops the auto-fill from stomping on a real edit. */
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [category, setCategory] = useState<Product["category"]>(initialData?.category ?? "bag");
  const [basePrice, setBasePrice] = useState(
    initialData ? String(initialData.basePrice) : "",
  );
  const [discountPercent, setDiscountPercent] = useState(
    initialData ? String(initialData.discountPercent) : "",
  );
  const [stockQuantity, setStockQuantity] = useState(
    initialData ? String(initialData.stockQuantity) : "",
  );
  const [featured, setFeatured] = useState(initialData?.featured ?? false);
  const [active, setActive] = useState(initialData?.active ?? true);

  const [colors, setColors] = useState<ColorDraft[]>(() => {
    if (!initialData) {
      /* One empty colour to start. A form with no colour block is a form whose first
         interaction is "Add colour", and the empty state there would be a list of one
         empty colour anyway. */
      return [{ key: "draft-0", name: "", hex: "#8B4513", images: {} }];
    }

    return initialData.colors.map((color) => ({
      key: color.id,
      name: color.name,
      hex: color.hex,
      /* `ColorVariant.images` is total — every angle exists, most holding `null`.
         `ColorDraft.images` is partial, where absent *means* "no photograph". So the
         nulls are dropped here rather than carried around as `undefined` lookups. */
      images: Object.fromEntries(
        Object.entries(color.images).filter(
          (entry): entry is [string, string] => entry[1] !== null,
        ),
      ) as Partial<Record<Angle, string>>,
    }));
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const nextKey = useRef(colors.length);

  /* The upload slots follow the category. Switching from bag to shoe swaps
     `side-left` for `laces`, and any photograph already in a shared slot —
     `front`, `side`, `back` — survives, because the slots are keyed by angle name
     and not by position. */
  const angles = useMemo(() => categoryAngles(category), [category]);

  const autoSlug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(autoSlug(value));
  };

  const addColor = () => {
    const key = `draft-${nextKey.current++}`;
    /* Inherit nothing from the previous colour — a new colourway is a new idea, and
       defaulting its name to the last one produces a row of identical names that
       then fail the uniqueness constraint on save. */
    setColors((current) => [...current, { key, name: "", hex: "#8B4513", images: {} }]);
  };

  const removeColor = (key: string) => {
    setColors((current) =>
      current.filter((color) => color.key !== key),
    );
  };

  const updateColor = (key: string, patch: Partial<ColorDraft>) => {
    setColors((current) =>
      current.map((color) => (color.key === key ? { ...color, ...patch } : color)),
    );
  };

  const handleUpload = async (colorKey: string, angle: Angle, file: File) => {
    const color = colors.find((entry) => entry.key === colorKey);
    if (!color) return;

    updateColor(colorKey, { uploading: angle, error: undefined });

    try {
      /* The slug is the storage path's first segment, so the folder is predictable
         before the product even has an id. */
      const url = await uploadProductImage(file, slug || "unassigned", color.name || "colour", angle);
      setColors((current) =>
        current.map((entry) =>
          entry.key === colorKey
            ? { ...entry, images: { ...entry.images, [angle]: url } }
            : entry,
        ),
      );
    } catch (error) {
      updateColor(colorKey, {
        error: error instanceof Error ? error.message : "That upload failed.",
      });
    } finally {
      setColors((current) =>
        current.map((entry) =>
          entry.key === colorKey ? { ...entry, uploading: undefined } : entry,
        ),
      );
    }
  };

  const removeImage = (colorKey: string, angle: Angle) => {
    setColors((current) =>
      current.map((entry) =>
        entry.key === colorKey
          ? {
              ...entry,
              images: Object.fromEntries(
                Object.entries(entry.images).filter(([key]) => key !== angle),
              ) as Partial<Record<Angle, string>>,
            }
          : entry,
      ),
    );
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    setErrors({});

    /* Photos are keyed by the colour's *position*, because the colour ids do not
       exist until the action has inserted them. The mapping happens in
       `createProduct`, where the ids come back ordered by `sort_order`. */
    const images = Object.fromEntries(
      colors.map((color, index) => [
        index,
        Object.fromEntries(Object.entries(color.images).filter(([, url]) => url)),
      ]),
    );

    const payload = {
      name,
      slug,
      description,
      category,
      basePrice,
      discountPercent,
      stockQuantity,
      featured,
      active,
      /* Only the two fields the server wants. `key`, `images`, `uploading` and
         `error` are all local UI state and are deliberately dropped here — sending
         them would make the action's schema depend on this component's internal
         shape. */
      colors: colors.map((color) => ({ name: color.name, hex: color.hex })),
      images,
    };

    /* Validated here so the person is told before a round trip, and again in the
       action because that is the one that has to be trusted. */
    const parsed = productInputSchema.safeParse(payload);
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path.join(".") ?? "form";
      setErrors({ [field]: parsed.error.issues[0]?.message ?? "Something is wrong." });
      toast.error("Check the form", parsed.error.issues[0]?.message);
      return;
    }

    setIsSaving(true);

    const result =
      mode === "create"
        ? await createProductAction(parsed.data)
        : await updateProductAction(initialData!.id, parsed.data);

    if (result.ok) {
      toast.success(mode === "create" ? "Product created" : "Product saved", name);
      /* `refresh` before `push`: the list has to re-read before it is rendered, or
         it shows the collection from before the save. */
      router.refresh();
      router.push("/admin/products");
      return;
    }

    setIsSaving(false);
    toast.error("That did not save", result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl pb-28">
      <div className="flex flex-col gap-8">
        <fieldset className="flex flex-col gap-4">
          <legend className="font-serif text-lg font-semibold tracking-tight text-foreground">
            The basics
          </legend>

          <Field label="Name" htmlFor="name" error={errors.name} required>
            <input
              id="name"
              value={name}
              onChange={(event) => handleNameChange(event.target.value)}
              autoComplete="off"
              className={inputClass(Boolean(errors.name))}
            />
          </Field>

          <Field
            label="URL slug"
            htmlFor="slug"
            error={errors.slug}
            required
            hint={`The shop will show this product at /${
              category === "shoe" ? "shoes" : "bags"
            }/${slug || "…"}`}
          >
            <input
              id="slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(autoSlug(event.target.value));
              }}
              autoComplete="off"
              spellCheck={false}
              className={inputClass(Boolean(errors.slug))}
            />
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            error={errors.description}
            required
            hint="One or two sentences. This is what the card shows."
          >
            <textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className={`${inputClass(Boolean(errors.description))} resize-y`}
            />
          </Field>

          <Field label="Category" error={errors.category} required>
            <div role="radiogroup" aria-label="Category" className="flex gap-2">
              {(["bag", "shoe"] as const).map((option) => {
                const selected = category === option;

                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setCategory(option)}
                    className={`inline-flex h-10 cursor-pointer items-center rounded-full border px-4 text-sm font-medium capitalize transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      selected
                        ? "border-primary bg-primary text-background"
                        : "border-border bg-card text-muted hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="font-serif text-lg font-semibold tracking-tight text-foreground">
            Price and stock
          </legend>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Price (KES)" htmlFor="basePrice" error={errors.basePrice} required>
              <input
                id="basePrice"
                type="number"
                inputMode="numeric"
                min={0}
                value={basePrice}
                onChange={(event) => setBasePrice(event.target.value)}
                className={inputClass(Boolean(errors.basePrice))}
              />
            </Field>

            <Field label="Discount (%)" htmlFor="discountPercent" error={errors.discountPercent}>
              <input
                id="discountPercent"
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                value={discountPercent}
                onChange={(event) => setDiscountPercent(event.target.value)}
                className={inputClass(Boolean(errors.discountPercent))}
              />
            </Field>

            <Field label="Stock" htmlFor="stockQuantity" error={errors.stockQuantity} required>
              <input
                id="stockQuantity"
                type="number"
                inputMode="numeric"
                min={0}
                value={stockQuantity}
                onChange={(event) => setStockQuantity(event.target.value)}
                className={inputClass(Boolean(errors.stockQuantity))}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-6 pt-1">
            <Switch checked={featured} onChange={setFeatured} label="Featured" />
            <Switch checked={active} onChange={setActive} label="Active" />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="font-serif text-lg font-semibold tracking-tight text-foreground">
            Colours
          </legend>

          {colors.map((color, index) => (
            <ColorBlock
              key={color.key}
              color={color}
              angles={angles}
              index={index}
              total={colors.length}
              errors={errors}
              onChange={(patch) => updateColor(color.key, patch)}
              onRemove={() => removeColor(color.key)}
              onUpload={(angle, file) => handleUpload(color.key, angle, file)}
              onRemoveImage={(angle) => removeImage(color.key, angle)}
            />
          ))}

          <div>
            <button
              type="button"
              onClick={addColor}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors duration-150 ease-out hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
              Add colour
            </button>

            {errors.colors ? (
              <p className="mt-2 text-sm text-primary">{errors.colors}</p>
            ) : null}
          </div>
        </fieldset>
      </div>

      {/* Sticky, because the colour section is long and the Save button must not be
          something you have to scroll back up to find after editing the fifth
          photograph of the third colourway. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <p className="hidden text-xs text-muted sm:block">
            {colors.length} {colors.length === 1 ? "colour" : "colours"} ·{" "}
            {colors.reduce(
              (total, color) => total + Object.values(color.images).filter(Boolean).length,
              0,
            )}{" "}
            photographs
          </p>

          <div className="ml-auto flex items-center gap-2">
            <a
              href="/admin/products"
              className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors duration-150 ease-out hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Cancel
            </a>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold tracking-wide text-background transition-colors duration-150 ease-out hover:bg-primary-deep active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 size={15} strokeWidth={2} className="animate-spin" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                <>
                  <Save size={15} strokeWidth={2} aria-hidden="true" />
                  {mode === "create" ? "Create" : "Save changes"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

/** One colourway: name, hex, and a slot per angle of the current category. */
function ColorBlock({
  color,
  angles,
  index,
  total,
  errors,
  onChange,
  onRemove,
  onUpload,
  onRemoveImage,
}: {
  color: ColorDraft;
  angles: Angle[];
  index: number;
  total: number;
  errors: Record<string, string>;
  onChange: (patch: Partial<ColorDraft>) => void;
  onRemove: () => void;
  onUpload: (angle: Angle, file: File) => void;
  onRemoveImage: (angle: Angle) => void;
}) {
  const reduceMotion = useReducedMotion();
  const fileInputs = useRef<Partial<Record<Angle, HTMLInputElement | null>>>({});

  /* A `<input type="file">` per slot, hidden, driven by a label. Drag and drop
     dispatches a `drop` on the label and sets `input.files` programmatically — which
     is the only way to make a drop behave exactly like a click. */
  const onDrop = (event: React.DragEvent, angle: Angle) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) onUpload(angle, file);
  };

  return (
    <motion.div
      layout={!reduceMotion}
      transition={{ type: "spring", duration: 0.3, bounce: 0 }}
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <label
            htmlFor={`color-${color.key}-name`}
            className="block text-sm font-medium text-foreground"
          >
            Colour {index + 1} name
          </label>
          <input
            id={`color-${color.key}-name`}
            value={color.name}
            onChange={(event) => onChange({ name: event.target.value })}
            autoComplete="off"
            className={`${inputClass(Boolean(errors[`colors.${index}.name`]))} mt-1`}
            placeholder="Cognac"
          />
        </div>

        {/* Native colour input plus a text field showing the hex. The native one is
            the pleasant way to choose; the text one is the honest one, because a hex
            has to be readable for a value the shop styles with it. */}
        <div>
          <label
            htmlFor={`color-${color.key}-hex`}
            className="block text-sm font-medium text-foreground"
          >
            Swatch
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={color.hex}
              onChange={(event) => onChange({ hex: event.target.value })}
              aria-label={`Pick a colour for ${color.name || `colour ${index + 1}`}`}
              className="h-10 w-12 cursor-pointer rounded-md border border-border bg-card p-1"
            />
            <input
              id={`color-${color.key}-hex`}
              value={color.hex}
              onChange={(event) => onChange({ hex: event.target.value })}
              spellCheck={false}
              className={`${inputClass(Boolean(errors[`colors.${index}.hex`]))} w-32 font-mono`}
            />
          </div>
        </div>

        {/* Never lets the form reach zero colours, because the schema requires at
            least one and a form that can produce a state it will refuse to save is a
            dead end. */}
        {total > 1 ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${color.name || `colour ${index + 1}`}`}
            className="inline-flex size-10 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors duration-150 ease-out hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* The slots. Two up on a phone, which is as narrow as a thumbnail can go
          before the angle label stops fitting beside it. */}
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {angles.map((angle) => {
          const url = color.images[angle];
          const isUploading = color.uploading === angle;

          return (
            <li key={angle}>
              <span className="block text-xs font-medium tracking-wide text-muted uppercase">
                {angleLabel(angle)}
              </span>

              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDrop(event, angle)}
                className="relative mt-1 aspect-square overflow-hidden rounded-lg border border-border bg-background"
              >
                {url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element --
                        A blob from the browser's own storage cache, and the point of
                        the slot is to show the file that was just picked without a
                        round trip. `next/image` would add an optimiser hop for an
                        image the person is looking at once, to confirm they picked the
                        right one. The customer's page uses `next/image`. */}
                    <img
                      src={url}
                      alt={`${color.name || "Colour"} ${angleLabel(angle)}`}
                      className="size-full object-cover"
                    />

                    <button
                      type="button"
                      onClick={() => onRemoveImage(angle)}
                      aria-label={`Remove the ${angleLabel(angle)} photograph`}
                      className="absolute top-1 right-1 inline-flex size-7 cursor-pointer items-center justify-center rounded-full bg-charcoal/75 text-background transition-colors duration-150 ease-out hover:bg-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      <X size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputs.current[angle]?.click()}
                    disabled={isUploading}
                    className="flex size-full cursor-pointer flex-col items-center justify-center gap-1 text-muted transition-colors duration-150 ease-out hover:bg-primary/5 hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:cursor-wait"
                  >
                    {isUploading ? (
                      <Loader2
                        size={18}
                        strokeWidth={2}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <ImagePlus size={18} strokeWidth={1.75} aria-hidden="true" />
                    )}
                    <span className="text-xs">{isUploading ? "Uploading" : "Add photo"}</span>
                  </button>
                )}

                <input
                  ref={(node) => {
                    fileInputs.current[angle] = node;
                  }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="hidden"
                  aria-label={`Choose a file for ${angleLabel(angle)}`}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onUpload(angle, file);
                    /* Cleared so choosing the *same* file twice fires `change` again.
                       Without this, replacing a photograph with an identical one does
                       nothing and looks like a bug. */
                    event.target.value = "";
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {color.error ? (
        <p role="alert" className="mt-3 text-sm text-primary">
          {color.error}
        </p>
      ) : null}
    </motion.div>
  );
}

/** Short display names, matching the stamps in the shop. */
function angleLabel(angle: Angle): string {
  return {
    front: "Front",
    "side-left": "Side L",
    "side-right": "Side R",
    side: "Side",
    top: "Top",
    bottom: "Bottom",
    back: "Back",
    laces: "Laces",
  }[angle];
}

/**
 * A labelled field.
 *
 * `htmlFor` is optional because the category picker is not an input — it is a
 * `role="radiogroup"` that carries its own `aria-label`. Rendering a `<label>` with no
 * `htmlFor` beside it would be a label pointing at nothing, which is worse than no
 * label element at all, so without `htmlFor` the text is a `<span>` and the group
 * keeps its own name.
 */
function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const labelContent = (
    <>
      {label}
      {required ? (
        <span aria-hidden="true" className="ml-0.5 text-primary">
          *
        </span>
      ) : null}
    </>
  );

  return (
    <div>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
          {labelContent}
        </label>
      ) : (
        <span className="block text-sm font-medium text-foreground">{labelContent}</span>
      )}

      <div className="mt-1">{children}</div>

      {error ? (
        <p role="alert" className="mt-1 text-sm text-primary">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-150 ease-out peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
          checked ? "" : "bg-border"
        }`}
      >
        <span
          className={`absolute size-5 rounded-full bg-card shadow-sm transition-transform duration-150 ease-out peer-checked:translate-x-4 ${
            checked ? "translate-x-0.5" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </label>
  );
}

/** One place that decides what an input looks like, so every field matches. */
function inputClass(hasError: boolean): string {
  return `h-10 w-full rounded-lg border bg-card px-3 text-sm text-foreground transition-colors duration-150 ease-out placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
    hasError ? "border-primary" : "border-border focus:border-primary"
  }`;
}