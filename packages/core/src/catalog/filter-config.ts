/** SOURCE OF TRUTH: the store's storefront filter settings — WHAT: which filter groups a collection or search page shows and in what order (availability, price, options, product extra fields, tags grouped by prefix such as `hand-large` → "Hand: Large", type, brand), kept in `store.preferences.storefrontFilters`, and the resolver both storefronts draw from (our theme's filter form and an imported theme's `collection.filters`) / WHY: Shopify's Search & discovery lets a merchant pick the filters; a store that never chose keeps today's filters. Pure, so the admin page and the browser can use it (`@commerce/core/filter-config`) */
import { z } from 'zod'
import { FILTER_PARAM, type FilterSlot, TAG_PREFIX } from './browse-params'

/** Where a filter group's values come from. */
export const FILTER_SOURCES = [
  'availability',
  'price',
  'option',
  'metafield',
  'tagGroup',
  'productType',
  'vendor',
  'giftCard',
  'tags',
] as const
export type FilterSource = (typeof FILTER_SOURCES)[number]

/** Sources that need a key: the option name, the field's `namespace.key`, the tag prefix. */
export const KEYED_SOURCES: readonly FilterSource[] = ['option', 'metafield', 'tagGroup']

export const MAX_FILTER_GROUPS = 30

const METAFIELD_KEY = /^[a-z][a-z0-9_]{0,63}\.[a-z][a-z0-9_]{0,63}$/

export const FilterGroupConfigSchema = z
  .object({
    source: z.enum(FILTER_SOURCES),
    key: z.string().trim().toLowerCase().max(130).optional(),
    /** The shopper-facing name; blank uses the default (the option's or field's own name). */
    label: z.string().trim().max(60).optional(),
  })
  .refine(
    (g) => {
      if (!KEYED_SOURCES.includes(g.source)) return true
      if (!g.key) return false
      if (g.source === 'metafield') return METAFIELD_KEY.test(g.key)
      if (g.source === 'tagGroup') return TAG_PREFIX.test(g.key)
      return g.key.length <= 100
    },
    { message: 'This filter needs a valid key' },
  )
export type FilterGroupConfig = z.infer<typeof FilterGroupConfigSchema>

export const StorefrontFilterConfigSchema = z.object({
  groups: z.array(FilterGroupConfigSchema).max(MAX_FILTER_GROUPS),
})
export type StorefrontFilterConfig = z.infer<typeof StorefrontFilterConfigSchema>

/** A stored config, or null when there is none or it no longer reads (the default applies). */
export function readFilterConfig(raw: unknown): StorefrontFilterConfig | null {
  if (raw === null || raw === undefined) return null
  const parsed = StorefrontFilterConfigSchema.safeParse(raw)
  return parsed.success ? dedupeGroups(parsed.data) : null
}

/** The identity of a group: one of each source and key. */
export const groupId = (g: { source: FilterSource; key?: string | undefined }): string =>
  KEYED_SOURCES.includes(g.source) ? `${g.source}:${g.key ?? ''}` : g.source

/** Drops repeats (the first wins) and empty labels. */
export function dedupeGroups(config: StorefrontFilterConfig): StorefrontFilterConfig {
  const seen = new Set<string>()
  const groups: FilterGroupConfig[] = []
  for (const g of config.groups) {
    const id = groupId(g)
    if (seen.has(id)) continue
    seen.add(id)
    groups.push({
      source: g.source,
      ...(KEYED_SOURCES.includes(g.source) ? { key: g.key } : {}),
      ...(g.label ? { label: g.label } : {}),
    })
  }
  return { groups }
}

/** The extra fields the config filters by (`namespace.key`), or null when there is no config. */
export function configMetafieldKeys(config: StorefrontFilterConfig | null): string[] | null {
  if (!config) return null
  return config.groups.flatMap((g) => (g.source === 'metafield' && g.key ? [g.key] : []))
}

/** Joining words a value keeps in lower case ("TKL or Full"). */
const SMALL_WORDS = /^(and|or|of|for|the|to)$/i

/** A tag's words after its prefix as a shopper reads them: `ultralight` → "Ultralight", `xl` → "XL". */
export function tagValueLabel(rest: string): string {
  return rest
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w, i) =>
      i > 0 && SMALL_WORDS.test(w)
        ? w.toLowerCase()
        : w.length <= 3 && /[a-z]/i.test(w) && !SMALL_WORDS.test(w)
          ? w.toUpperCase()
          : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(' ')
}

/** "hand" → "Hand", "pad-size" → "Pad size": a tag group's default name. */
export function tagPrefixLabel(prefix: string): string {
  const words = prefix.split(/[-_]+/).filter(Boolean)
  const text = words.join(' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

type Counted = { value: string; count: number }

/** The values of one tag group (`hand-large` → `large`), counts summed for tags that differ in case only. */
export function tagGroupValues(tags: Counted[], prefix: string): Counted[] {
  const head = `${prefix}-`
  const out = new Map<string, number>()
  for (const t of tags) {
    const lower = t.value.toLowerCase()
    if (!lower.startsWith(head) || lower.length === head.length) continue
    const rest = lower.slice(head.length)
    out.set(rest, (out.get(rest) ?? 0) + t.count)
  }
  return [...out]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }))
}

/**
 * Prefixes the store's tags fall into, for the settings page: the part before the first dash
 * of tags shaped `prefix-value`, where at least two tags share it. Most products first.
 */
export function tagPrefixes(tags: Counted[]): { prefix: string; values: Counted[] }[] {
  const prefixes = new Set<string>()
  for (const t of tags) {
    const m = /^([a-z0-9_]+)-./.exec(t.value.toLowerCase())
    if (m?.[1] && TAG_PREFIX.test(m[1])) prefixes.add(m[1])
  }
  return [...prefixes]
    .map((prefix) => ({ prefix, values: tagGroupValues(tags, prefix) }))
    .filter((p) => p.values.length >= 2 || (p.values[0]?.count ?? 0) >= 2)
    .sort(
      (a, b) =>
        b.values.reduce((s, v) => s + v.count, 0) - a.values.reduce((s, v) => s + v.count, 0) ||
        a.prefix.localeCompare(b.prefix),
    )
}

/** The facets the resolver reads; `BrowseFacets` from `browse.ts` has this shape. */
export type FilterFacets = {
  inStock: number
  outOfStock: number
  giftCards: number
  products: number
  priceMax: number | null
  productTypes: Counted[]
  vendors: Counted[]
  tags: Counted[]
  options: { key: string; name: string; values: Counted[] }[]
  metafields: { key: string; name: string; type: 'list' | 'boolean'; values: Counted[] }[]
}

/** One filter group to draw, in order. */
export type ResolvedFilterGroup = {
  /** Stable for React keys and ids. */
  id: string
  source: FilterSource
  /** The merchant's name for it, the option's or field's own, or null for the drawer's default. */
  label: string | null
  slot: FilterSlot
  /** The URL parameter a value is sent under. */
  param: string
  type: 'list' | 'boolean' | 'price_range'
  /** `label` is set where the value is not what a shopper reads (tag groups); availability, kind and yes/no values are labelled by the drawer. */
  values: (Counted & { label?: string })[]
  /** Highest price in the listing, paise (price groups only). */
  priceMax?: number
}

/**
 * Where the default list differs: our theme's drawer also shows the gift-card kind and the
 * first tags; an imported theme gets Shopify's own defaults.
 */
export type FilterSurface = 'theme' | 'liquid'

/** Tags our drawer lists by default, at most. */
const DEFAULT_TAGS = 30

/** Today's filters, for a store that never chose: what each surface showed before settings. */
function defaultGroups(facets: FilterFacets, surface: FilterSurface): FilterGroupConfig[] {
  const groups: FilterGroupConfig[] = [{ source: 'availability' }]
  if (surface === 'theme') groups.push({ source: 'giftCard' })
  groups.push({ source: 'price' })
  for (const o of facets.options) groups.push({ source: 'option', key: o.key })
  for (const m of facets.metafields) groups.push({ source: 'metafield', key: m.key })
  groups.push({ source: 'productType' }, { source: 'vendor' })
  if (surface === 'theme') groups.push({ source: 'tags' })
  return groups
}

/**
 * The filter groups a listing shows: the store's choice in its order, or today's default when it
 * has none. A group with nothing to pick in this listing is left out (a chosen type or brand with
 * one value still shows; in the default they need two, as before).
 */
export function resolveFilterGroups(
  facets: FilterFacets,
  config: StorefrontFilterConfig | null,
  surface: FilterSurface,
): ResolvedFilterGroup[] {
  const chosen = config !== null
  const groups = config?.groups ?? defaultGroups(facets, surface)
  const out: ResolvedFilterGroup[] = []
  for (const g of groups) {
    const label = g.label || null
    const id = groupId(g)
    const list = (
      slot: FilterSlot,
      param: string,
      values: ResolvedFilterGroup['values'],
      fallback: string | null = null,
      type: 'list' | 'boolean' = 'list',
    ) => {
      if (values.length > 0) {
        out.push({ id, source: g.source, label: label ?? fallback, slot, param, type, values })
      }
    }
    switch (g.source) {
      case 'availability':
        if (facets.inStock + facets.outOfStock > 0) {
          list({ field: 'available' }, FILTER_PARAM.available, [
            { value: '1', count: facets.inStock },
            { value: '0', count: facets.outOfStock },
          ])
        }
        break
      case 'giftCard':
        if (facets.giftCards > 0 && facets.products > 0) {
          list({ field: 'giftCard' }, FILTER_PARAM.giftCard, [
            { value: '0', count: facets.products },
            { value: '1', count: facets.giftCards },
          ])
        }
        break
      case 'price':
        if (facets.priceMax !== null && facets.priceMax > 0) {
          out.push({
            id,
            source: 'price',
            label,
            slot: { field: 'price' },
            param: 'filter.v.price',
            type: 'price_range',
            values: [],
            priceMax: facets.priceMax,
          })
        }
        break
      case 'productType':
        if (facets.productTypes.length > (chosen ? 0 : 1)) {
          list({ field: 'productTypes' }, FILTER_PARAM.productType, facets.productTypes)
        }
        break
      case 'vendor':
        if (facets.vendors.length > (chosen ? 0 : 1)) {
          list({ field: 'vendors' }, FILTER_PARAM.vendor, facets.vendors)
        }
        break
      case 'tags':
        list({ field: 'tags' }, FILTER_PARAM.tag, facets.tags.slice(0, DEFAULT_TAGS))
        break
      case 'option': {
        const o = facets.options.find((x) => x.key === g.key)
        if (o)
          list(
            { field: 'options', key: o.key },
            `${FILTER_PARAM.optionPrefix}${o.key}`,
            o.values,
            o.name,
          )
        break
      }
      case 'metafield': {
        const m = facets.metafields.find((x) => x.key === g.key)
        if (m) {
          list(
            { field: 'metafields', key: m.key },
            `${FILTER_PARAM.metafieldPrefix}${m.key}`,
            m.values,
            m.name,
            m.type,
          )
        }
        break
      }
      case 'tagGroup': {
        const prefix = g.key ?? ''
        list(
          { field: 'tagGroups', key: prefix },
          `${FILTER_PARAM.tagGroupPrefix}${prefix}`,
          tagGroupValues(facets.tags, prefix).map((v) => ({ ...v, label: tagValueLabel(v.value) })),
          tagPrefixLabel(prefix),
        )
        break
      }
    }
  }
  return out
}
