/**
 * Storefront filter and sort parameters, in Shopify's URL shape so links and
 * habits carry over: `filter.v.availability=1`, `filter.v.price.gte=500` (rupees),
 * `filter.p.product_type=Mouse`, `filter.p.vendor=…`, `filter.p.tag=…`,
 * `filter.v.option.size=M`, `filter.p.m.custom.grip=Claw`, `sort_by=price-ascending`, `page=2`, and our
 * tag groups, `filter.p.tag.hand=large` for the tag `hand-large`. Pure, so the
 * filter drawer can build the same URLs in the browser (`@commerce/core/browse`).
 */

export type BrowseSort =
  | 'manual'
  | 'relevance'
  | 'best-selling'
  | 'title-ascending'
  | 'title-descending'
  | 'price-ascending'
  | 'price-descending'
  | 'created-descending'

export const BROWSE_SORTS: readonly BrowseSort[] = [
  'manual',
  'relevance',
  'best-selling',
  'title-ascending',
  'title-descending',
  'price-ascending',
  'price-descending',
  'created-descending',
]

export type BrowseFilters = {
  /** true: only in stock, false: only sold out, null: both. */
  available: boolean | null
  /** true: only gift cards, false: only other products, null: both. */
  giftCard: boolean | null
  /** Paise, inclusive, against the product's lowest variant price. */
  priceMin: number | null
  priceMax: number | null
  productTypes: string[]
  vendors: string[]
  tags: string[]
  /**
   * Tags grouped by prefix, as the store's filter settings name them: `hand` to `['large']`
   * matches the tag `hand-large`. Any value within a group, every group.
   */
  tagGroups: Record<string, string[]>
  /** Lower-cased option name ("size", "colour") to the values picked. */
  options: Record<string, string[]>
  /** Product extra field (`namespace.key`, as stored) to the values picked. */
  metafields: Record<string, string[]>
}

export const EMPTY_FILTERS: BrowseFilters = {
  available: null,
  giftCard: null,
  priceMin: null,
  priceMax: null,
  productTypes: [],
  vendors: [],
  tags: [],
  tagGroups: {},
  options: {},
  metafields: {},
}

export type SearchParamsInput = Record<string, string | string[] | undefined>

export const FILTER_PARAM = {
  available: 'filter.v.availability',
  giftCard: 'filter.p.gift_card',
  priceMin: 'filter.v.price.gte',
  priceMax: 'filter.v.price.lte',
  productType: 'filter.p.product_type',
  vendor: 'filter.p.vendor',
  tag: 'filter.p.tag',
  /** A tag group: `filter.p.tag.hand=large` for the tag `hand-large`. */
  tagGroupPrefix: 'filter.p.tag.',
  optionPrefix: 'filter.v.option.',
  /** Shopify's product metafield filters: `filter.p.m.custom.grip=Claw`. */
  metafieldPrefix: 'filter.p.m.',
} as const

/** A stored `namespace.key` (lower snake case each side), or null. */
const METAFIELD_KEY = /^[a-z][a-z0-9_]{0,63}\.[a-z][a-z0-9_]{0,63}$/

const MAX_VALUES = 20

/** A tag group's prefix: what comes before the dash in `hand-large`, lower case. */
export const TAG_PREFIX = /^[a-z0-9][a-z0-9_]{0,39}(?:-[a-z0-9_]{1,40}){0,2}$/

const list = (v: string | string[] | undefined): string[] => {
  const all = Array.isArray(v) ? v : v === undefined ? [] : [v]
  return [
    ...new Set(all.map((s) => s.trim()).filter((s) => s.length > 0 && s.length <= 100)),
  ].slice(0, MAX_VALUES)
}

const rupees = (v: string | string[] | undefined): number | null => {
  const raw = list(v)[0]
  if (raw === undefined) return null
  const n = Number(raw.replace(/[,₹\s]/g, ''))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null
}

/** Shopify's namespace or key as we store it (`hand-size` → `hand_size`), like `keyFromName`. */
const storedKey = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

/** Filters from a request's search params; anything malformed is ignored. */
export function parseBrowseFilters(params: SearchParamsInput): BrowseFilters {
  const avail = list(params[FILTER_PARAM.available])
  const gift = list(params[FILTER_PARAM.giftCard])
  const options: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(params)) {
    if (!key.startsWith(FILTER_PARAM.optionPrefix)) continue
    const name = key.slice(FILTER_PARAM.optionPrefix.length).trim().toLowerCase()
    const values = list(value)
    if (name && values.length > 0) options[name] = values
  }
  const tagGroups: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(params)) {
    if (!key.startsWith(FILTER_PARAM.tagGroupPrefix)) continue
    const prefix = key.slice(FILTER_PARAM.tagGroupPrefix.length).trim().toLowerCase()
    const values = list(value)
    if (TAG_PREFIX.test(prefix) && values.length > 0) tagGroups[prefix] = values
  }
  const metafields: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(params)) {
    if (!key.startsWith(FILTER_PARAM.metafieldPrefix)) continue
    // Shopify writes the namespace and key as the theme does (`shopify--x`, `hand-size`).
    const [ns = '', ...rest] = key.slice(FILTER_PARAM.metafieldPrefix.length).split('.')
    const field = `${storedKey(ns)}.${storedKey(rest.join('.'))}`
    const values = list(value)
    if (METAFIELD_KEY.test(field) && values.length > 0) metafields[field] = values
  }
  // Both availability boxes ticked means no availability filter at all.
  const available =
    avail.includes('1') && !avail.includes('0')
      ? true
      : avail.includes('0') && !avail.includes('1')
        ? false
        : null
  // Both kind boxes ticked is no kind filter, as with availability.
  const giftCard =
    gift.includes('1') && !gift.includes('0')
      ? true
      : gift.includes('0') && !gift.includes('1')
        ? false
        : null
  let priceMin = rupees(params[FILTER_PARAM.priceMin])
  let priceMax = rupees(params[FILTER_PARAM.priceMax])
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
    ;[priceMin, priceMax] = [priceMax, priceMin]
  }
  return {
    available,
    giftCard,
    priceMin,
    priceMax,
    productTypes: list(params[FILTER_PARAM.productType]),
    vendors: list(params[FILTER_PARAM.vendor]),
    tags: list(params[FILTER_PARAM.tag]),
    tagGroups,
    options,
    metafields,
  }
}

export function parseBrowseSort(
  raw: unknown,
  allowed: readonly BrowseSort[],
  fallback: BrowseSort,
): BrowseSort {
  return typeof raw === 'string' && (allowed as readonly string[]).includes(raw)
    ? (raw as BrowseSort)
    : fallback
}

/**
 * Sold-out products in a search, as Shopify's `options[unavailable_products]`: `show` where
 * they rank, `last` after every buyable one, `hide` left out.
 */
export type UnavailableProducts = 'show' | 'last' | 'hide'

/** Shopify's `options[unavailable_products]` value; `show` for anything else. */
export function parseUnavailable(raw: unknown): UnavailableProducts {
  const v = Array.isArray(raw) ? raw[0] : raw
  return v === 'last' || v === 'hide' ? v : 'show'
}

export function parsePage(raw: unknown): number {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN
  return Number.isFinite(n) && n > 0 ? Math.min(n, 1000) : 1
}

export const hasActiveFilters = (f: BrowseFilters): boolean =>
  f.available !== null ||
  f.giftCard !== null ||
  f.priceMin !== null ||
  f.priceMax !== null ||
  f.productTypes.length > 0 ||
  f.vendors.length > 0 ||
  f.tags.length > 0 ||
  Object.keys(f.tagGroups).length > 0 ||
  Object.keys(f.options).length > 0 ||
  Object.keys(f.metafields).length > 0

/** The query-string pairs for a set of filters, in a stable order. */
export function filterEntries(f: BrowseFilters): [string, string][] {
  const out: [string, string][] = []
  if (f.available !== null) out.push([FILTER_PARAM.available, f.available ? '1' : '0'])
  if (f.giftCard !== null) out.push([FILTER_PARAM.giftCard, f.giftCard ? '1' : '0'])
  if (f.priceMin !== null) out.push([FILTER_PARAM.priceMin, String(f.priceMin / 100)])
  if (f.priceMax !== null) out.push([FILTER_PARAM.priceMax, String(f.priceMax / 100)])
  for (const v of f.productTypes) out.push([FILTER_PARAM.productType, v])
  for (const v of f.vendors) out.push([FILTER_PARAM.vendor, v])
  for (const v of f.tags) out.push([FILTER_PARAM.tag, v])
  for (const [prefix, values] of Object.entries(f.tagGroups)) {
    for (const v of values) out.push([`${FILTER_PARAM.tagGroupPrefix}${prefix}`, v])
  }
  for (const [name, values] of Object.entries(f.options)) {
    for (const v of values) out.push([`${FILTER_PARAM.optionPrefix}${name}`, v])
  }
  for (const [field, values] of Object.entries(f.metafields)) {
    for (const v of values) out.push([`${FILTER_PARAM.metafieldPrefix}${field}`, v])
  }
  return out
}

/** Build `?…` for a browse page from its parts; empty parts are left out. */
export function browseHref(
  path: string,
  parts: { q?: string | undefined; filters?: BrowseFilters; sort?: string | null; page?: number },
): string {
  const params = new URLSearchParams()
  if (parts.q) params.set('q', parts.q)
  for (const [k, v] of filterEntries(parts.filters ?? EMPTY_FILTERS)) params.append(k, v)
  if (parts.sort) params.set('sort_by', parts.sort)
  if (parts.page && parts.page > 1) params.set('page', String(parts.page))
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

/** One active filter as a removable chip: what it says and the filters without it. */
export type ActiveFilter = { key: string; kind: string; value: string; without: BrowseFilters }

export function activeFilters(f: BrowseFilters): ActiveFilter[] {
  const out: ActiveFilter[] = []
  if (f.available !== null) {
    out.push({
      key: 'available',
      kind: 'available',
      value: String(f.available),
      without: { ...f, available: null },
    })
  }
  if (f.giftCard !== null) {
    out.push({
      key: 'giftCard',
      kind: 'giftCard',
      value: String(f.giftCard),
      without: { ...f, giftCard: null },
    })
  }
  if (f.priceMin !== null || f.priceMax !== null) {
    out.push({
      key: 'price',
      kind: 'price',
      value: `${f.priceMin ?? ''}-${f.priceMax ?? ''}`,
      without: { ...f, priceMin: null, priceMax: null },
    })
  }
  const lists = [
    ['productTypes', 'productType'],
    ['vendors', 'vendor'],
    ['tags', 'tag'],
  ] as const
  for (const [field, kind] of lists) {
    for (const v of f[field]) {
      out.push({
        key: `${kind}:${v}`,
        kind,
        value: v,
        without: { ...f, [field]: f[field].filter((x) => x !== v) },
      })
    }
  }
  const keyed = [
    ['tagGroups', 'tagGroup'],
    ['options', 'option'],
    ['metafields', 'metafield'],
  ] as const
  for (const [field, kind] of keyed) {
    for (const [name, values] of Object.entries(f[field])) {
      for (const v of values) {
        out.push({
          key: `${kind}:${name}:${v}`,
          kind: `${kind}:${name}`,
          value: v,
          without: withValues(
            f,
            { field, key: name },
            values.filter((x) => x !== v),
          ),
        })
      }
    }
  }
  return out
}

/** Where one filter's picked values live in `BrowseFilters`. */
export type FilterSlot =
  | { field: 'available' | 'giftCard' | 'price' | 'productTypes' | 'vendors' | 'tags' }
  | { field: 'options' | 'metafields' | 'tagGroups'; key: string }

/** One filter's picked values, as the URL carries them (`1`/`0` for the yes/no ones). */
export function pickedValues(f: BrowseFilters, slot: FilterSlot): string[] {
  switch (slot.field) {
    case 'available':
      return f.available === null ? [] : [f.available ? '1' : '0']
    case 'giftCard':
      return f.giftCard === null ? [] : [f.giftCard ? '1' : '0']
    case 'price':
      return []
    case 'productTypes':
    case 'vendors':
    case 'tags':
      return f[slot.field]
    default:
      return f[slot.field][slot.key] ?? []
  }
}

/** The filters with one filter's values replaced (empty clears it). */
export function withValues(f: BrowseFilters, slot: FilterSlot, values: string[]): BrowseFilters {
  const yesNo = values.length === 1 ? values[0] === '1' : null
  switch (slot.field) {
    case 'available':
      return { ...f, available: yesNo }
    case 'giftCard':
      return { ...f, giftCard: yesNo }
    case 'price':
      return values.length === 0 ? { ...f, priceMin: null, priceMax: null } : f
    case 'productTypes':
    case 'vendors':
    case 'tags':
      return { ...f, [slot.field]: values }
    default: {
      const next = { ...f[slot.field] }
      if (values.length > 0) next[slot.key] = values
      else delete next[slot.key]
      return { ...f, [slot.field]: next }
    }
  }
}
