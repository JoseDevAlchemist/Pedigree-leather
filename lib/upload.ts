import { createClient } from "@/lib/supabase/client";
import type { Angle } from "@/lib/types";

/**
 * Uploading product photography.
 *
 * This runs from a client component, so it uses the **browser** client and the anon
 * key. That is not a compromise: the storage policies in 002_storage.sql grant
 * `authenticated` upload rights, and the admin's browser carries the signed-in
 * user's JWT. RLS decides, and it decides correctly — an anonymous visitor hitting
 * this function gets nothing, because there is no policy that lets them.
 *
 * The service role key is not involved and must not be: this code path runs in the
 * browser, and a key that reaches the browser is a key that has leaked.
 *
 * Note the contrast with `lib/admin-api.ts`, which *is* service role, because it
 * must see inactive products and must work in a server action where there is no
 * session to carry. Two clients, two jobs, and the reason each one is the right one
 * is written down in both files.
 */

/** The bucket created by supabase/migrations/002_storage.sql. */
export const BUCKET = "product-images";

/** Set by `002_storage.sql` to 8 MB. Checked here so the message can be specific. */
const MAX_BYTES = 8 * 1024 * 1024;

/** The same list the bucket's `allowed_mime_types` accepts. */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * `Oxblood` -> `oxblood`. Slugs, not hashes.
 *
 * A readable path matters: the first thing anybody does with a storage bucket that
 * is behaving oddly is open it and read the filenames. A hex digest would have made
 * that impossible and taught nobody anything.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    /* Strip the accents NFKD split apart, so "Café" and "Cafe" agree. */
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The extension for a mime type, so the path ends in something meaningful. */
const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/**
 * `<productSlug>/<colour>-<angle>.<ext>`.
 *
 * One file per slot, no version suffix. That is what makes re-uploading a
 * photograph idempotent: the new file overwrites the old one at the same path, so
 * there is never a stale `-2.jpg` to clean up and no orphaned object left in the
 * bucket when somebody replaces a photo.
 *
 * Exported because the admin form shows the path it is about to write, and a person
 * should be able to see that two colours are not going to collide.
 */
export function imagePath(
  productSlug: string,
  colorName: string,
  angle: Angle,
  mimeType: string,
): string {
  const extension = EXTENSION[mimeType] ?? "bin";
  return `${slugify(productSlug)}/${slugify(colorName)}-${angle}.${extension}`;
}

/** A public URL for a stored path. */
export function publicImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

/**
 * Upload one photograph and return its public URL.
 *
 * Rejects before touching the network on anything the database would reject anyway:
 * the wrong type, or too big. A round trip that returns a 400 with a Postgres error
 * text is a worse error message than a sentence, and it costs the user a wait.
 *
 * `upsert: true` maps onto Supabase's storage upsert, so replacing a photo in a slot
 * overwrites rather than creating a second object.
 */
export async function uploadProductImage(
  file: File,
  productSlug: string,
  colorName: string,
  angle: Angle,
): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(
      `${file.name} is a ${file.type || "unknown type"}. Upload a JPEG, PNG, WebP or AVIF.`,
    );
  }

  if (file.size > MAX_BYTES) {
    throw new Error(
      `${file.name} is ${Math.round(file.size / 1024 / 1024)} MB. The limit is 8 MB — resize it before uploading.`,
    );
  }

  if (file.size === 0) {
    throw new Error(`${file.name} is empty.`);
  }

  const supabase = createClient();
  const path = imagePath(productSlug, colorName, angle, file.type);

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    /* Replace whatever is in this slot. See the note on `imagePath`. */
    upsert: true,
    /* Belt and braces: the bucket also constrains mime types, and a client-side
       check is advisory while this one is not. */
    contentType: file.type,
    cacheControl: "31536000",
  });

  if (error) {
    /* The most common cause by far, and the least obvious from the message. */
    if (/row-level security|permission denied/i.test(error.message)) {
      throw new Error(
        "The storage policy rejected this upload. Sign in again, and check that 002_storage.sql has been run.",
      );
    }
    throw error;
  }

  return publicImageUrl(path);
}

/**
 * Remove a stored photograph.
 *
 * Called when the admin deletes an image slot. The row is deleted by
 * `updateProduct` on save; this gets rid of the object in the bucket so an
 * unpublishing product does not leave its photography behind in storage.
 *
 * Best-effort by design: a missing object is not an error worth failing a save for,
 * because the row is the source of truth and the file is a consequence of it.
 */
export async function deleteProductImage(publicUrl: string): Promise<void> {
  const base = `/storage/v1/object/public/${BUCKET}/`;
  const index = publicUrl.indexOf(base);
  if (index === -1) return;

  const path = decodeURIComponent(publicUrl.slice(index + base.length));
  const supabase = createClient();

  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.warn(`[pedigree/upload] could not remove ${path}: ${error.message}`);
}