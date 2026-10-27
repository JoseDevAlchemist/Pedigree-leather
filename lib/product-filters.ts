/**
 * Shared product-filter vocabulary for the shop.
 *
 * The category page parses the URL on the server, the filter panel builds a new
 * URL on the client, and the data layer turns the same values into Supabase
 * filters. Keeping the parsing and serialisation here means those three places
 * cannot disagree about what `sort=price_asc` or `colors=black,brown` means.
 */

export const PRODUCT_SORTS = ["newest", "price_asc", "price_desc"] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const SORT_OPTIONS: readonly { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price (Low to High)" },
  { value: "price_desc", label: "Price (High to Low)" },
];

export type PriceBand = {
  id: string;
  label: string;
  minPrice?: number;
  maxPrice?: number;
};

export const PRICE_BANDS: readonly PriceBand[] = [
  { id: "under-10k", label: "Under 10K", maxPrice: 9_999 },
  { id: "10k-20k", label: "10K – 20K", minPrice: 10_000, maxPrice: 20_000 },
  { id: "over-20k", label: "Over 20K", minPrice: 20_001 },
];

export type ProductFilters = {
  /** Canonical, lower-case colour keys. Resolve these to stored names in the data layer. */
  colors: string[];
  minPrice?: number;
  maxPrice?: number;
  sort: ProductSort;
};

/**
 * A colour as the UI shows it, plus every exact database spelling it represents.
 * The live catalogue contains both `Brown` and `brown`; they should be one
 * checkbox, but PostgREST needs both names when filtering.
 */
export type CategoryColorOption = {
  /** Canonical lower-case key used in the URL and checkbox state. */
  value: string;
  /** Human label, e.g. `Cognac Brown`. */
  label: string;
  /** Swatch fill from the first stored colour with this key. */
  hex: string;
  /** Exact `product_colors.color_name` values this option covers. */
  values: string[];
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseAmount(value: string | string[] | undefined): number | undefined {
  const raw = firstValue(value)?.trim();
  if (!raw) return undefined;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;

  return Math.round(parsed);
}

/**
 * Read the shop's filter params from Next's `searchParams` prop or a
 * `URLSearchParams` object flattened into the same shape.
 *
 * `colors=black,brown` is the canonical form, but repeated `colors` params are
 * accepted too. The result is deduplicated and sorted so equivalent URLs produce
 * the same cache key and the same UI state.
 */
export function parseProductFilters(params: RawSearchParams): ProductFilters {
  const rawColors = Array.isArray(params.colors)
    ? params.colors
    : params.colors
      ? [params.colors]
      : [];

  const colors = [
    ...new Set(
      rawColors
        .flatMap((value) => value.split(","))
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].sort();

  const rawSort = firstValue(params.sort);
  const sort = PRODUCT_SORTS.includes(rawSort as ProductSort)
    ? (rawSort as ProductSort)
    : "newest";

  let minPrice = parseAmount(params.minPrice);
  let maxPrice = parseAmount(params.maxPrice);

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  return { colors, minPrice, maxPrice, sort };
}

/** The inverse of `parseProductFilters`, with defaults omitted from the URL. */
export function buildProductFilterQuery(filters: ProductFilters): string {
  const params = new URLSearchParams();

  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.colors.length > 0) params.set("colors", filters.colors.join(","));
  if (filters.minPrice !== undefined) {
    params.set("minPrice", String(filters.minPrice));
  }
  if (filters.maxPrice !== undefined) {
    params.set("maxPrice", String(filters.maxPrice));
  }

  return params.toString();
}

export function isPriceBandActive(
  filters: ProductFilters,
  band: PriceBand,
): boolean {
  return filters.minPrice === band.minPrice && filters.maxPrice === band.maxPrice;
}

/** Colour count plus the price band, for the mobile button's badge. */
export function countActiveFilters(filters: ProductFilters): number {
  return (
    filters.colors.length +
    (filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0)
  );
}

/**
 * Turn canonical checkbox keys into the exact names stored in Postgres.
 *
 * If an option was not discovered in the category's facet list, the key itself
 * is used. That keeps a hand-written URL such as `?colors=Brown` useful instead
 * of silently returning nothing.
 */
export function resolveColorNames(
  selected: readonly string[],
  options: readonly CategoryColorOption[],
): string[] {
  const names = new Set<string>();

  for (const key of selected) {
    const option = options.find((entry) => entry.value === key);
    if (!option) {
      names.add(key);
      continue;
    }

    for (const value of option.values) names.add(value);
  }

  return [...names];
}
