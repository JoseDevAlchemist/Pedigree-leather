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
 *   - Passes through local (`/`) assets, data/blob URIs, and external URLs that
 *     are not Supabase storage URLs unchanged.
 *   - Extracts the storage path from a Supabase public URL and rewrites it to the
 *     render endpoint with `width`, `quality` and `format=webp`.
 *   - Requests a square derivative (`height` equal to `width`, `resize=cover`).
 *     Every product frame is square and already uses `object-cover`, so cropping
 *     at the renderer discards the off-frame area before it is downloaded
 *     instead of sending a tall original and letting the browser throw it away.
 *   - Caps the render width: phone-sized requests become 800px and desktop-sized
 *     requests become 1200px. Fixed thumbnails (cart, admin table) keep their
 *     requested 64–256px width instead of being upscaled.
 *   - Preserves cache-busting query params such as `?v=...`. Stored image URLs
 *     carry one after a replacement upload, and treating that query as part of
 *     the path produced `?v=...?width=...`, which made Supabase ignore the width
 *     and serve a near-original file.
 *   - Treats any other relative string as a storage path and rewrites it the same way.
 *   - Falls back without throwing when `NEXT_PUBLIC_SUPABASE_URL` is absent at
 *     build time: a full Supabase URL still supplies its own origin, and anything
 *     else is returned untouched. A missing env var must not break a deploy.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");

/** `/storage/v1/object/public/<bucket>/<path>` */
const OBJECT_PATH_RE = /^\/?storage\/v1\/object\/public\/([^/]+)\/(.+)$/;

/** `/storage/v1/render/image/public/<bucket>/<path>` */
const RENDER_PATH_RE = /^\/?storage\/v1\/render\/image\/public\/([^/]+)\/(.+)$/;

/** Params we own. Anything else on the source URL is a cache-buster or tracking. */
const RESERVED_PARAMS = new Set(["width", "quality", "format", "height", "resize"]);

/**
 * Fixed-size thumbnails below this stay at their requested width. Upscaling a
 * 64px cart line to 800px would spend bandwidth on pixels nobody can see.
 */
const THUMBNAIL_MAX_WIDTH = 160;

/** A phone-sized product frame. 800px is still ~2x on a 390px screen. */
const MOBILE_IMAGE_WIDTH = 800;

/** A desktop product frame. 1200px is sharp at 50vw without the 1440–1600px bill. */
const DESKTOP_IMAGE_WIDTH = 1200;

/**
 * `next/image` gives us a physical width candidate, not the viewport width. A
 * 3x phone asking for a full-width detail image can therefore arrive as 1440.
 * Normalising here stops that download without needing a second loader.
 */
function optimizedWidth(requested: number): number {
  if (requested <= THUMBNAIL_MAX_WIDTH) return requested;
  return requested <= MOBILE_IMAGE_WIDTH ? MOBILE_IMAGE_WIDTH : DESKTOP_IMAGE_WIDTH;
}

function renderUrl(
  origin: string,
  bucket: string,
  path: string,
  sourceParams: URLSearchParams,
  width: number,
  quality: number,
): string {
  const url = new URL(
    `${origin}/storage/v1/render/image/public/${bucket}/${path}`,
  );

  /* Keep `v=...` so replacing a photograph at the same storage path still
     bypasses the CDN cache, but never keep a stale width/quality/format. */
  sourceParams.forEach((value, key) => {
    if (!RESERVED_PARAMS.has(key)) url.searchParams.set(key, value);
  });

  url.searchParams.set("width", String(width));
  /* The layout always displays product photography in a square well with
     `object-cover`; crop server-side so the browser never downloads the parts
     of a tall original that the frame would hide. */
  url.searchParams.set("height", String(width));
  url.searchParams.set("resize", "cover");
  url.searchParams.set("quality", String(quality));
  /* Supabase also honours the browser's Accept header. Setting this explicitly
     keeps the result WebP even when a proxy strips or rewrites Accept. */
  url.searchParams.set("format", "webp");

  return url.toString();
}

export default function supabaseLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width?: number;
  quality?: number;
}): string {
  /* Local assets (the logo) and browser-local URLs are not Supabase objects. */
  if (src.startsWith("/") || /^(data|blob):/i.test(src)) return src;

  const safeWidth = optimizedWidth(Math.max(1, Math.round(width ?? 400)));
  const safeQuality = Math.min(100, Math.max(1, Math.round(quality ?? 75)));

  if (/^https?:\/\//i.test(src)) {
    let source: URL;
    try {
      source = new URL(src);
    } catch {
      return src;
    }

    const match =
      source.pathname.match(OBJECT_PATH_RE) ??
      source.pathname.match(RENDER_PATH_RE);

    /* External CDN, data URI, etc. — leave alone. */
    if (!match) return src;

    /* A full Supabase public URL carries its own origin. Prefer it, so images
       still render if the env var was not present when the bundle was built. */
    return renderUrl(
      source.origin,
      match[1],
      match[2],
      source.searchParams,
      safeWidth,
      safeQuality,
    );
  }

  /* Without an origin there is no render endpoint to point at. Returning the
     original value is the only safe fallback; it keeps the build and render
     alive instead of emitting `undefined/storage/...`. */
  if (!SUPABASE_URL) return src;

  /* A storage path, optionally with the same `?v=` cache-buster as a full URL.
     `URL` gives us the query without hand-splitting on `?`, which is what broke
     the old loader. */
  let relative: URL;
  try {
    relative = new URL(src, "https://supabase.local");
  } catch {
    return src;
  }

  const pathname = relative.pathname.replace(/^\/+/, "");
  const match =
    pathname.match(OBJECT_PATH_RE) ??
    pathname.match(RENDER_PATH_RE) ??
    pathname.match(/^([^/]+)\/(.+)$/);

  if (!match) return src;

  return renderUrl(
    SUPABASE_URL,
    match[1],
    match[2],
    relative.searchParams,
    safeWidth,
    safeQuality,
  );
}
