const PUBLIC_OBJECT = "/storage/v1/object/public/";
const PUBLIC_RENDER = "/storage/v1/render/image/public/";
const STORAGE_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");

/** Resolve legacy photo sources without changing the encoded object key or query. */
export function originalProductImageUrl(src: string): string {
  const absolute = /^(https?:\/\/[^/?#]+)(\/[^?#]*)/i.exec(src);
  if (absolute) {
    const [prefix, origin, pathname] = absolute;
    if (!pathname.startsWith(PUBLIC_RENDER)) return src;

    return origin + PUBLIC_OBJECT + pathname.slice(PUBLIC_RENDER.length) + src.slice(prefix.length);
  }

  if (!STORAGE_ORIGIN || !/^[^:/?#]+\/[^/?#]/.test(src)) return src;

  const path = "/" + src;
  if (path.startsWith(PUBLIC_OBJECT)) return STORAGE_ORIGIN + path;
  if (path.startsWith(PUBLIC_RENDER)) {
    return STORAGE_ORIGIN + PUBLIC_OBJECT + path.slice(PUBLIC_RENDER.length);
  }

  return STORAGE_ORIGIN + PUBLIC_OBJECT + src;
}

const RESPONSIVE_OBJECT = /-r([1-9]\d*)x([1-9]\d*)\.webp(?=[?#]|$)/;

/** Only uploads with both objects use this suffix. Existing photos stay direct. */
export function productPhotoVariant(src: string) {
  const match = RESPONSIVE_OBJECT.exec(src);
  if (!match) return null;
  return {
    url: src.replace(RESPONSIVE_OBJECT, "-card.webp"),
    cardWidth: Number(match[1]),
    originalWidth: Number(match[2]),
  };
}
