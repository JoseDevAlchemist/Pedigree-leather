"use client";

import { motion, useReducedMotion } from "motion/react";
import { ImagePlus, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { createProductAction, updateProductAction } from "@/lib/actions/products";
import { ALL_ANGLES, angleOrder, categoryAngles } from "@/lib/angles";
import { uploadProductImage } from "@/lib/upload";
import type { AdminProduct } from "@/lib/mappers";
import type { Angle, Category, Product } from "@/lib/types";
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
 * hex and an arbitrary subset of the eight available views, and it needs to be added,
 * removed and reordered as a unit — which a flat `<FormData>` cannot express and which
 * would make the server action's schema depend on the order of an array of arrays.
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

/**
 * What the file picker will accept.
 *
 * Deliberately narrower than the storage bucket's allow-list, which also takes
 * AVIF: JPEG, PNG and WebP are what a camera, a phone and the workshop's
 * exports actually produce, and a surprise container is far more likely to be a
 * mistake than an intention. The bucket's own check remains the backstop for
 * anything that gets past this.
 */
const ACCEPTED_IMAGE_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];

/**
 * 4 MB, below the bucket's 8 MB ceiling. The renderer's output quality and size
 * are driven by the original, so rejecting an oversized source here is cheaper
 * than letting it into storage and paying for it on every storefront request.
 */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** A sentence describing why a file is unusable, or `null` when it is fine. */
function fileProblem(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return `${file.name || "That file"} is not a JPEG, PNG or WebP image.`;
  }
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > MAX_UPLOAD_BYTES) {
    return "This image is too large. Please resize it to under 4MB before uploading.";
  }
  return null;
}

/**
 * Stamp a URL so a replaced photograph is not served from a stale cache.
 *
 * A slot always writes to the same storage path (see `imagePath` in
 * `lib/upload.ts`), and storage serves that path with a one-year cache. With an
 * unchanged URL, replacing a photo leaves the old bytes in the browser and in
 * the Next image optimiser no matter how many times the admin saves. The `?v=`
 * seed makes the URL new, so both layers fetch the file that is actually there.
 */
function withCacheBuster(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
}

/** The basename of a stored URL, for slots filled in an earlier session. */
function fileNameFromUrl(url: string): string {
  return decodeURIComponent(url.split("?")[0].split("/").pop() ?? "");
}

type ColorDraft = {
  /** Stable key for React. The database id is unknown for a colour being created. */
  key: string;
  name: string;
  hex: string;
  /** Units on hand for this colourway. Kept as a string while the form is open. */
  stockQuantity: string;
  /**
   * The views this colour currently has slots for, in display order.
   *
   * This is the admin's working set, not the database. An empty slot is still a
   * slot here so the person can upload into it; only slots with a URL are sent
   * to the server on save.
   */
  slots: Angle[];
  /** Slot -> public URL. Missing means "no photograph", which is not an error. */
  images: Partial<Record<Angle, string>>;
  /**
   * Slot -> object URL of a file still uploading. Shown in place of the stored
   * photograph so the person sees the exact file they picked while the round
   * trip is in flight, then discarded.
   */
  previews?: Partial<Record<Angle, string>>;
  /** Slot -> the name of the file in that slot, so a pick can be verified. */
  fileNames?: Partial<Record<Angle, string>>;
  /** Slot currently uploading. One at a time, so the grid does not flicker. */
  uploading?: Angle;
  error?: string;
};

export function ProductForm({
  mode,
  initialData,
  categories = [],
}: {
  mode: "create" | "edit";
  initialData?: AdminProduct;
  /** Server-fetched active categories for the category select. */
  categories?: readonly Category[];
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
  const [categoryId, setCategoryId] = useState<string | null>(
    initialData?.categoryId ?? null,
  );
  const [basePrice, setBasePrice] = useState(
    initialData ? String(initialData.basePrice) : "",
  );
  const [basePriceUsd, setBasePriceUsd] = useState(
    initialData?.basePriceUsd != null ? String(initialData.basePriceUsd) : "",
  );
  const [discountPercent, setDiscountPercent] = useState(
    initialData ? String(initialData.discountPercent) : "",
  );
  const [featured, setFeatured] = useState(initialData?.featured ?? false);
  const [active, setActive] = useState(initialData?.active ?? true);

  const [colors, setColors] = useState<ColorDraft[]>(() => {
    if (!initialData) {
      /* One colour with the category's default slots. The defaults are only a
         starting point now: the admin can remove any of them and add any other
         view, and only slots with a URL are written to the database. */
      return [
        {
          key: "draft-0",
          name: "",
          hex: "#8B4513",
          stockQuantity: "1",
          slots: categoryAngles("bag"),
          images: {},
        },
      ];
    }

    const defaultAngles = categoryAngles(initialData.category);

    return initialData.colors.map((color) => {
      /* `ColorVariant.images` has a key for every angle in the product's roll,
         most holding `null`. `ColorDraft.images` is partial, where absent *means*
         "no photograph". So the nulls are dropped here rather than carried around
         as `undefined` lookups. */
      const images = Object.fromEntries(
        Object.entries(color.images).filter(
          (entry): entry is [string, string] => entry[1] !== null,
        ),
      ) as Partial<Record<Angle, string>>;

      /* Open with exactly the views this colour already has, in the product's
         order. A legacy colour with no photographs still gets the category's
         default slots so it can be photographed without an extra click. */
      const used = initialData.angles.filter((angle) => images[angle]);
      const extras = ALL_ANGLES.filter(
        (angle) => images[angle] && !used.includes(angle),
      );

      return {
        key: color.id,
        name: color.name,
        hex: color.hex,
        stockQuantity: String(color.stockQuantity),
        slots: used.length > 0 ? [...used, ...extras] : defaultAngles,
        images,
      };
    });
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const nextKey = useRef(colors.length);

  /**
   * The category select is grouped by parent: a parent becomes an `<optgroup>`
   * label and its children become the options inside it. Flattening here rather
   * than in `getCategories` keeps the API layer able to serve the navbar, the
   * sitemap and this form without each consumer re-deriving a tree.
   */
  const categoryGroups = useMemo(() => {
    const childrenByParent = new Map<string, Category[]>();
    for (const entry of categories) {
      if (!entry.parentId) continue;
      const siblings = childrenByParent.get(entry.parentId) ?? [];
      siblings.push(entry);
      childrenByParent.set(entry.parentId, siblings);
    }

    const groups = categories
      .filter((entry) => !entry.parentId)
      .map((parent) => ({
        parent,
        children: childrenByParent.get(parent.id) ?? [],
      }));

    const groupedIds = new Set<string>();
    for (const group of groups) {
      groupedIds.add(group.parent.id);
      for (const child of group.children) groupedIds.add(child.id);
    }

    return {
      groups,
      orphans: categories.filter((entry) => !groupedIds.has(entry.id)),
    };
  }, [categories]);

  /**
   * The shop still routes on the legacy `bag`/`shoe` column, so picking a dynamic
   * category has to keep that column in step. The root of the selected branch
   * decides the detail route; image slots are independent of it and are never
   * rebuilt here, so changing category cannot discard photographs.
   */
  const handleCategoryChange = (value: string) => {
    setCategoryId(value || null);
    if (!value) return;

    const selected = categories.find((entry) => entry.id === value);
    if (!selected) return;

    const nextCategory = legacyCategoryFor(selected, categories);
    setCategory(nextCategory);

    /* An empty colour block is just a set of slots, so switching from Bags to
       Shoes can swap the default views without losing anything. A colour that
       already has a photograph keeps its slots exactly as the admin arranged
       them — changing category must never silently hide a saved image. */
    setColors((current) =>
      current.map((color) =>
        Object.values(color.images).some(Boolean) || color.uploading
          ? color
          : { ...color, slots: categoryAngles(nextCategory) },
      ),
    );
  };

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
    setColors((current) => [
      ...current,
      {
        key,
        name: "",
        hex: "#8B4513",
        stockQuantity: "1",
        slots: categoryAngles(category),
        images: {},
      },
    ]);
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

  /**
   * Add the next unused view to one colour.
   *
   * The category's own views are offered first (so a bag's sixth slot is the one
   * that makes sense for a bag), then the remaining vocabulary. The DB's unique
   * `(color_id, angle)` constraint means a view can only appear once per colour.
   */
  const addImageSlot = (colorKey: string) => {
    const color = colors.find((entry) => entry.key === colorKey);
    if (!color) return;

    const next = angleOrder(category).find((angle) => !color.slots.includes(angle));
    if (!next) {
      toast.error(
        "No views left",
        "All eight views already have a slot. Remove one before adding another.",
      );
      return;
    }

    updateColor(colorKey, { slots: [...color.slots, next] });
  };

  /**
   * Remove a slot and whatever photograph was in it.
   *
   * A pending blob is released here; the storage object itself is left alone
   * because cancelling the form after this point must not break a saved product.
   */
  const removeImageSlot = (colorKey: string, angle: Angle) => {
    const color = colors.find((entry) => entry.key === colorKey);
    if (!color) return;
    if (color.uploading === angle) {
      toast.error("Upload still running", "Wait for this photograph to finish first.");
      return;
    }

    const pending = color.previews?.[angle];
    if (pending) URL.revokeObjectURL(pending);

    setColors((current) =>
      current.map((entry) => {
        if (entry.key !== colorKey) return entry;

        const images = { ...entry.images };
        delete images[angle];
        const previews = { ...entry.previews };
        delete previews[angle];
        const fileNames = { ...entry.fileNames };
        delete fileNames[angle];

        return {
          ...entry,
          slots: entry.slots.filter((slot) => slot !== angle),
          images,
          previews,
          fileNames,
        };
      }),
    );
  };

  const handleUpload = async (colorKey: string, angle: Angle, file: File) => {
    const color = colors.find((entry) => entry.key === colorKey);
    if (!color) return;

    /* Reject the wrong file here, before it reaches the bucket, so the person
       gets a sentence rather than a storage error. The input is cleared by its
       own handler either way, so a rejected file can still be chosen again. */
    const problem = fileProblem(file);
    if (problem) {
      toast.error("That file cannot be used", problem);
      return;
    }

    /* Show the pick immediately — a blob preview and its name — so the file can
       be confirmed before the upload has even finished. */
    const previewUrl = URL.createObjectURL(file);
    updateColor(colorKey, {
      uploading: angle,
      error: undefined,
      previews: { ...color.previews, [angle]: previewUrl },
      fileNames: { ...color.fileNames, [angle]: file.name },
    });

    try {
      /* The slug is the storage path's first segment, so the folder is predictable
         before the product even has an id. */
      const url = await uploadProductImage(file, slug || "unassigned", color.name || "colour", angle);
      setColors((current) =>
        current.map((entry) => {
          if (entry.key !== colorKey) return entry;
          const previews = { ...entry.previews };
          delete previews[angle];
          return {
            ...entry,
            images: { ...entry.images, [angle]: withCacheBuster(url) },
            previews,
          };
        }),
      );
    } catch (error) {
      setColors((current) =>
        current.map((entry) => {
          if (entry.key !== colorKey) return entry;
          const previews = { ...entry.previews };
          delete previews[angle];
          return {
            ...entry,
            previews,
            error: error instanceof Error ? error.message : "That upload failed.",
          };
        }),
      );
    } finally {
      /* The stored URL takes over from the blob once the upload resolves. */
      URL.revokeObjectURL(previewUrl);
      setColors((current) =>
        current.map((entry) =>
          entry.key === colorKey ? { ...entry, uploading: undefined } : entry,
        ),
      );
    }
  };

  const removeImage = (colorKey: string, angle: Angle) => {
    /* A blob still pending for this slot is ours to release. */
    const pending = colors.find((entry) => entry.key === colorKey)?.previews?.[angle];
    if (pending) URL.revokeObjectURL(pending);

    setColors((current) =>
      current.map((entry) => {
        if (entry.key !== colorKey) return entry;

        const previews = { ...entry.previews };
        delete previews[angle];
        const fileNames = { ...entry.fileNames };
        delete fileNames[angle];

        return {
          ...entry,
          images: Object.fromEntries(
            Object.entries(entry.images).filter(([key]) => key !== angle),
          ) as Partial<Record<Angle, string>>,
          previews,
          fileNames,
        };
      }),
    );
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    setErrors({});

    /* Photos are keyed by the colour's *position*, because the colour ids do not
       exist until the action has inserted them. Only slots that actually hold a
       URL are included: an empty slot is a UI convenience, not a database row.
       The array order is preserved into `product_images.sort_order`. */
    const images = Object.fromEntries(
      colors.map((color, index) => [
        index,
        color.slots.flatMap((angle) => {
          const url = color.images[angle];
          return url ? [{ angle, url }] : [];
        }),
      ]),
    );

    const payload = {
      name,
      slug,
      description,
      category,
      categoryId,
      basePrice,
      basePriceUsd: basePriceUsd ? Number(basePriceUsd) : null,
      discountPercent,
      featured,
      active,
      /* Only the fields the server wants. `key`, `images`, `uploading` and
         `error` are all local UI state and are deliberately dropped here — sending
         them would make the action's schema depend on this component's internal
         shape. */
      colors: colors.map((color) => ({
        name: color.name,
        hex: color.hex,
        stockQuantity: color.stockQuantity,
      })),
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

          <Field
            label="Category"
            htmlFor="categoryId"
            error={errors.categoryId}
            hint={
              categories.length === 0
                ? "No categories are available yet. Create them under Categories first; until then the product saves as a bag."
                : "Choose the department and shelf this product belongs to. The parent group maps it onto /bags or /shoes."
            }
          >
            <select
              id="categoryId"
              value={categoryId ?? ""}
              onChange={(event) => handleCategoryChange(event.target.value)}
              className={inputClass(Boolean(errors.categoryId))}
            >
              <option value="">None (uncategorised)</option>

              {categoryGroups.groups.map(({ parent, children }) => (
                <optgroup key={parent.id} label={parent.name}>
                  {/* The parent itself is selectable: the migration backfills
                      every legacy 'bag'/'shoe' product onto its parent, and an
                      edit form whose select has no matching option would silently
                      reset that product to uncategorised. */}
                  <option value={parent.id}>All {parent.name}</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </optgroup>
              ))}

              {/* An active child whose parent is inactive is not in any group
                  above. It still has to be selectable, or opening an existing
                  product would lose its category on save. */}
              {categoryGroups.orphans.length > 0 ? (
                <optgroup label="Other">
                  {categoryGroups.orphans.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
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
                required
                value={basePrice}
                onChange={(event) => setBasePrice(event.target.value)}
                className={inputClass(Boolean(errors.basePrice))}
              />
            </Field>

            <Field
              label="Price in USD (optional)"
              htmlFor="basePriceUsd"
              error={errors.basePriceUsd}
              hint="Leave blank if this product is only sold in KES."
            >
              <input
                id="basePriceUsd"
                type="number"
                inputMode="numeric"
                min={1}
                value={basePriceUsd}
                onChange={(event) => setBasePriceUsd(event.target.value)}
                className={inputClass(Boolean(errors.basePriceUsd))}
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

          <p className="-mt-2 text-xs text-muted">JPEG, PNG or WebP, up to 4 MB each.</p>

          {colors.map((color, index) => (
            <ColorBlock
              key={color.key}
              color={color}
              index={index}
              total={colors.length}
              errors={errors}
              onChange={(patch) => updateColor(color.key, patch)}
              onRemove={() => removeColor(color.key)}
              onUpload={(angle, file) => handleUpload(color.key, angle, file)}
              onRemoveImage={(angle) => removeImage(color.key, angle)}
              onAddSlot={() => addImageSlot(color.key)}
              onRemoveSlot={(angle) => removeImageSlot(color.key, angle)}
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

/**
 * The legacy `Product["category"]` for a dynamic category.
 *
 * Walks to the root of the branch and reads its slug and name. This is a bridge,
 * not a long-term model: the two detail routes are still `/bags/[slug]` and
 * `/shoes/[slug]`, so every product has to resolve to one of them. Anything that
 * is neither footwear nor a bag falls back to `bag`, which matches the old
 * default and keeps an unrecognised top-level category from producing a broken
 * URL.
 */
function legacyCategoryFor(
  category: Category,
  all: readonly Category[],
): Product["category"] {
  let current: Category | undefined = category;
  const visited = new Set<string>();

  while (current && current.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    const parentId: string = current.parentId;
    current = all.find((entry) => entry.id === parentId);
  }

  const root = current ?? category;
  const label = `${root.slug} ${root.name}`.toLowerCase();

  return /shoe|sneaker|boot|sandal|loafer|heel/.test(label) ? "shoe" : "bag";
}

/** One colourway: name, hex, and as many image slots as the admin wants. */
function ColorBlock({
  color,
  index,
  total,
  errors,
  onChange,
  onRemove,
  onUpload,
  onRemoveImage,
  onAddSlot,
  onRemoveSlot,
}: {
  color: ColorDraft;
  index: number;
  total: number;
  errors: Record<string, string>;
  onChange: (patch: Partial<ColorDraft>) => void;
  onRemove: () => void;
  onUpload: (angle: Angle, file: File) => void;
  onRemoveImage: (angle: Angle) => void;
  onAddSlot: () => void;
  onRemoveSlot: (angle: Angle) => void;
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

        <div>
          <label
            htmlFor={`color-${color.key}-stock`}
            className="block text-sm font-medium text-foreground"
          >
            Stock
          </label>
          <input
            id={`color-${color.key}-stock`}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={color.stockQuantity}
            onChange={(event) => onChange({ stockQuantity: event.target.value })}
            className={`${inputClass(Boolean(errors[`colors.${index}.stockQuantity`]))} mt-1 w-24`}
          />
          {errors[`colors.${index}.stockQuantity`] ? (
            <p role="alert" className="mt-1 max-w-48 text-sm text-primary">
              {errors[`colors.${index}.stockQuantity`]}
            </p>
          ) : null}
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
          before the angle label stops fitting beside it. The list is the admin's
          own ordered set; empty slots are allowed and ignored on save. */}
      {color.slots.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {color.slots.map((angle) => {
            const url = color.images[angle];
            const preview = color.previews?.[angle];
            /* The blob wins while an upload is in flight: it is the file just
               chosen, which is the whole reason to show a preview at all. */
            const shown = preview ?? url;
            const fileName =
              color.fileNames?.[angle] ?? (url ? fileNameFromUrl(url) : undefined);
            const isUploading = color.uploading === angle;

            return (
              <li key={angle}>
                <div className="flex items-center justify-between gap-2">
                  <span className="block text-xs font-medium tracking-wide text-muted uppercase">
                    {angleLabel(angle)}
                  </span>

                  <button
                    type="button"
                    onClick={() => onRemoveSlot(angle)}
                    disabled={isUploading}
                    aria-label={`Remove the ${angleLabel(angle)} image slot`}
                    title={
                      isUploading
                        ? "Wait for this upload to finish"
                        : `Remove the ${angleLabel(angle)} slot`
                    }
                    className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-muted transition-colors duration-150 ease-out hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-40"
                  >
                    <Trash2 size={12} strokeWidth={2} aria-hidden="true" />
                  </button>
                </div>

                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => onDrop(event, angle)}
                  className="relative mt-1 aspect-square overflow-hidden rounded-lg border border-border bg-background"
                >
                  {shown ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element --
                          A blob from the browser's own storage cache, and the point of
                          the slot is to show the file that was just picked without a
                          round trip. `next/image` would add an optimiser hop for an
                          image the person is looking at once, to confirm they picked the
                          right one. The customer's page uses `next/image`. */}
                      <img
                        src={shown}
                        alt={`${color.name || "Colour"} ${angleLabel(angle)}`}
                        className="size-full object-cover"
                      />

                      {isUploading ? (
                        /* No clear button mid-flight: the file is already on its way,
                           and clearing the preview would only diverge from the upload. */
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 flex items-center justify-center bg-charcoal/40"
                        >
                          <Loader2
                            size={18}
                            strokeWidth={2}
                            className="animate-spin text-background"
                          />
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onRemoveImage(angle)}
                          aria-label={`Clear the ${angleLabel(angle)} photograph`}
                          className="absolute top-1 right-1 inline-flex size-7 cursor-pointer items-center justify-center rounded-full bg-charcoal/75 text-background transition-colors duration-150 ease-out hover:bg-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          <X size={14} strokeWidth={2} aria-hidden="true" />
                        </button>
                      )}
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
                    accept={ACCEPTED_IMAGE_TYPES.join(",")}
                    className="hidden"
                    aria-label={`Choose a file for ${angleLabel(angle)}`}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) onUpload(angle, file);
                      /* Cleared so choosing the *same* file twice fires `change` again.
                         Without this, replacing a photograph with an identical one does
                         nothing and looks like a bug — and a rejected file, which
                         changes nothing else, could never be re-picked. */
                      event.target.value = "";
                    }}
                  />
                </div>

                {/* The name, so a pick can be verified at a glance. Truncated to the
                    slot width; `title` keeps the full name reachable. */}
                {fileName ? (
                  <p className="mt-1 truncate text-[0.6875rem] text-muted" title={fileName}>
                    {fileName}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          No image slots yet. Add one below to start photographing this colour.
        </p>
      )}

      <button
        type="button"
        onClick={onAddSlot}
        disabled={color.slots.length >= ALL_ANGLES.length}
        className="mt-2 inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors duration-150 ease-out hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus size={14} strokeWidth={2} aria-hidden="true" />
        Add image slot
      </button>

      <p className="mt-1 text-[0.6875rem] text-muted">
        {color.slots.length} of {ALL_ANGLES.length} views · empty slots are not saved
      </p>

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
 * `htmlFor` is optional because a caller may eventually place a non-input here
 * (a custom picker that carries its own `aria-label`). Rendering a `<label>` with
 * no `htmlFor` beside it would be a label pointing at nothing, which is worse
 * than no label element at all, so without `htmlFor` the text is a `<span>`.
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