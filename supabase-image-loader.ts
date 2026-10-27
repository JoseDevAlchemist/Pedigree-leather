/**
 * Supabase image loader for Next.js `next/image`.
 *
 * Serves resized WebP derivatives from Supabase's built-in image transformation
 * endpoint (`/storage/v1/render/image/public/...`). One high-quality original
 * lives in storage; this loader asks for the size the slot actually needs.
 *
 * Usage: images.loader = 'custom', images.loaderFile = './supabase-image-loader'
 * in next.config.ts. Callers pass a storage path (e.g. `product-images/karura-tote/black-front.jpg`)
 * or a full Supabase public URL as `src`.
 *
 * The loader:
 *   - Passes through local (`/`) and external (non-Supabase absolute) URLs unchanged.
 *   - Extracts the storage path from a Supabase public URL and rewrites it to the
 *     render endpoint with `width` and `quality` query params.
 *   - Treats any other relative string as a storage path and rewrites it the same way.
 *   - Falls back without throwing when `NEXT_PUBLIC_SUPABASE_URL` is absent at
 *     build time: a full Supabase URL still supplies its own origin, and anything
 *     else is returned untouched. A missing env var must not break a deploy.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");

/** `https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>` */
const PUBLIC_OBJECT_RE =
  /^(https?:\/\/[^/]+)\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;

export default function supabaseLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width?: number;
  quality?: number;
}): string {
  /* Local files (the logo): pass through untouched. */
  if (src.startsWith("/")) return src;

  let storagePath = src;
  let baseUrl = SUPABASE_URL;

  if (src.startsWith("http://") || src.startsWith("https://")) {
    const match = src.match(PUBLIC_OBJECT_RE);
    /* External CDN, data URI, etc. — leave alone. */
    if (!match) return src;

    /* A full Supabase public URL carries its own origin. Prefer it, so images
       still render if the env var was not present when the bundle was built. */
    baseUrl = match[1];
    storagePath = `${match[2]}/${match[3]}`;
  }

  /* Without an origin there is no render endpoint to point at. Returning the
     original value is the only safe fallback; it keeps the build and render
     alive instead of emitting `undefined/storage/...`. */
  if (!baseUrl) return src;

  return `${baseUrl}/storage/v1/render/image/public/${storagePath}?width=${width ?? 400}&quality=${quality ?? 75}`;
}
