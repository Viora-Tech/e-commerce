/** SOURCE OF TRUTH: dynamic source values — WHAT how a loaded source value becomes what a connected setting receives (text, link, image, colour, number), or its typed-in fallback / WHY the editor preview and the storefront renderer must show a connected setting the same way. No database. */
import { formatInZone } from '@commerce/dates'
import { measurementText, moneyText, normaliseHex, ratingText } from '../metaobjects/field-values'
import {
  type Binding,
  isBinding,
  isCompatible,
  isPlainData,
  isSettingKind,
  type SettingKind,
  type SourceType,
  type SourceValues,
} from './format'

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const COLOUR =
  /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\([0-9.,%\s/+-]+\)|[a-z]{3,20})$/i

/** A calendar day (`2026-01-31`) as `31 January 2026`; a day has no zone, so it reads in UTC. */
function formatDate(s: string): string {
  const m = DATE.exec(s)
  if (!m) return s
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return formatInZone(
    date,
    { day: 'numeric', month: 'long', year: 'numeric' },
    { locale: 'en-IN', timeZone: 'UTC' },
  )
}

const asRecord = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

const safeUrl = (s: unknown): string | null =>
  typeof s === 'string' && (/^https?:\/\//i.test(s) || /^\/(?![/\\])/.test(s)) ? s : null

const SLUG = /^[a-z0-9][a-z0-9-]*$/i

/** Where a link source points: an address, or a loaded record's storefront path. */
const linkHref = (type: SourceType, v: unknown): string | null => {
  if (type === 'url') return safeUrl(v)
  const r = asRecord(v)
  if (type === 'link') return safeUrl(r.url)
  const handle = type === 'variant_reference' ? r.productHandle : r.handle
  if (typeof handle !== 'string' || !SLUG.test(handle)) return null
  switch (type) {
    case 'product_reference':
      return `/products/${handle}`
    case 'collection_reference':
      return `/collections/${handle}`
    case 'page_reference':
      return `/pages/${handle}`
    case 'article_reference':
      return typeof r.blogHandle === 'string' && SLUG.test(r.blogHandle)
        ? `/blogs/${r.blogHandle}/${handle}`
        : null
    case 'variant_reference':
      return typeof r.id === 'string' ? `/products/${handle}?variant=${r.id}` : null
    default:
      return null
  }
}

/** The words a link source brings along: a link's own text, or the record's title. */
const linkLabel = (type: SourceType, v: unknown): string => {
  const r = asRecord(v)
  const label = type === 'link' ? r.label : type === 'variant_reference' ? r.productTitle : r.title
  return typeof label === 'string' ? label : ''
}

/** A source's value as plain text for a text setting, or undefined when it has none. */
function textOf(
  type: SourceType,
  value: unknown,
  timeZone: string | undefined,
): string | undefined {
  switch (type) {
    case 'money':
      return moneyText(value) ?? undefined
    case 'date':
      return typeof value === 'string' ? formatDate(value) : undefined
    case 'date_time':
      return typeof value === 'string' && !Number.isNaN(Date.parse(value))
        ? formatInZone(
            value,
            { dateStyle: 'long', timeStyle: 'short' },
            timeZone ? { timeZone } : {},
          )
        : undefined
    case 'rating':
      return ratingText(value) ?? undefined
    case 'measurement':
      return measurementText(value) ?? undefined
    default:
      if (typeof value === 'number') return String(value)
      return typeof value === 'string' ? value : undefined
  }
}

const isEmpty = (v: unknown): boolean =>
  v === undefined ||
  v === null ||
  (typeof v === 'string' && v.trim() === '') ||
  (Array.isArray(v) && v.length === 0)

/**
 * A loaded source value in the shape its setting expects, or `undefined` when
 * the source is empty or unusable (the caller then renders the fallback).
 * Images and links keep the fallback's other keys (alt text, button label).
 */
function coerceValue(
  kind: SettingKind,
  type: SourceType,
  value: unknown,
  fallback: unknown,
  timeZone?: string | undefined,
): unknown {
  if (isEmpty(value) || Array.isArray(value) || !isCompatible(kind, type)) return undefined
  switch (kind) {
    case 'text':
      return textOf(type, value, timeZone)
    case 'richtext':
      return typeof value === 'string' || asRecord(value).root ? value : undefined
    case 'number': {
      const raw = type === 'rating' ? asRecord(value).value : value
      const n = typeof raw === 'number' ? raw : Number(raw)
      return Number.isFinite(n) ? n : undefined
    }
    case 'image': {
      const img = asRecord(value)
      const url = safeUrl(img.url)
      if (!url) return undefined
      const alt = typeof img.alt === 'string' && img.alt ? img.alt : asRecord(fallback).alt
      return { ...asRecord(fallback), url, alt: alt ?? '' }
    }
    case 'color':
      if (type === 'color') return normaliseHex(value) ?? undefined
      return typeof value === 'string' && COLOUR.test(value.trim()) ? value.trim() : undefined
    case 'url':
      return linkHref(type, value) ?? undefined
    case 'link': {
      const href = linkHref(type, value)
      if (!href) return undefined
      const base = asRecord(fallback)
      const typed = typeof base.label === 'string' ? base.label : ''
      const own = linkLabel(type, value)
      // A link field's own text wins; a record's title only fills a blank button label.
      const label = type === 'link' ? own || typed : typed || own
      return { ...base, label, href }
    }
  }
}

/**
 * A loaded value as a setting of `kind` receives it, or `undefined` when it is empty or does
 * not fit (loops use it for each mapped field of a row; see `./loops.ts`).
 */
export const coerceSourceValue = (
  kind: SettingKind,
  type: SourceType,
  value: unknown,
  timeZone?: string | undefined,
): unknown => coerceValue(kind, type, value, undefined, timeZone)

/** A list binding (`./loops.ts`); checked here by shape so the two modules do not import each other. */
const loopFallback = (value: object): unknown[] | null => {
  const v = value as { $loop?: unknown; fallback?: unknown }
  if (typeof v.$loop !== 'object' || v.$loop === null) return null
  return Array.isArray(v.fallback) ? v.fallback : []
}

/** The value a binding renders: the source when it has one, else the typed-in fallback. */
function resolveBinding(binding: Binding, values: SourceValues): unknown {
  const loaded = values[binding.$source]
  const resolved =
    loaded && isSettingKind(binding.kind)
      ? coerceValue(binding.kind, loaded.type, loaded.value, binding.fallback, loaded.timeZone)
      : undefined
  return resolved !== undefined ? resolved : binding.fallback
}

function replace(
  value: unknown,
  values: SourceValues,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (isBinding(value)) return resolveBinding(value, values)
  if (typeof value !== 'object' || value === null) return value
  // Non-JSON values (React elements, class instances) and repeat visits pass through untouched.
  if (seen.has(value) || !isPlainData(value)) return value
  // A list not filled yet (`applyLoops` runs first where the store can be read) shows its rows.
  const rows = Array.isArray(value) ? null : loopFallback(value)
  if (rows) return replace(rows, values, seen)
  seen.add(value)
  if (Array.isArray(value)) return value.map((v) => replace(v, values, seen))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    const next = replace(v, values, seen)
    // An empty source with nothing typed in leaves the key out, so defaults apply.
    if (next !== undefined) out[k] = next
  }
  return out
}

/**
 * Template data with every binding swapped for its value (or fallback). Pass no
 * values to get the typed-in fallbacks only, which is what code that cannot load
 * sources (resolveData in the editor) should see.
 */
export function applyBindings<T>(data: T, values: SourceValues = {}): T {
  return replace(data, values) as T
}
