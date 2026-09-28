/** SOURCE OF TRUTH: dynamic source bindings — WHAT the `{ $source, kind, fallback }` format in section settings, source paths, setting/source type compatibility, validation and value resolution with fallback / WHY the editor, Save and the storefront renderer must read bindings the same way. No database. */
import { formatMoney } from '@commerce/money'
import type { FieldType } from '../metaobjects/schemas'

/**
 * Dynamic sources ("Connect dynamic source" in Shopify's theme editor): a section
 * or block setting that reads its value from store data at render time instead of
 * holding it. Pure and browser-safe (`@commerce/core/dynamic-sources`); the server
 * loader lives in `./service.ts`.
 *
 * A connected setting stores a binding in place of its value, inside the section's
 * props in the template JSON:
 *
 *   { "$source": "product.metafields.custom.material", "kind": "text", "fallback": "Cotton" }
 *
 * `kind` is the setting's own type (what the section expects to receive), and
 * `fallback` is whatever was typed in before connecting; it renders whenever the
 * source is empty (the product has no material set, the entry was deleted).
 */

/** Setting types that can be connected. `link` is a `{ label, href }` object, `url` a plain href string. */
export const SETTING_KINDS = [
  'text',
  'richtext',
  'image',
  'link',
  'url',
  'number',
  'color',
] as const
export type SettingKind = (typeof SETTING_KINDS)[number]

/** What a source holds: a metafield value type, or `money` (paise) for prices. */
export type SourceType = FieldType | 'money'

export type Binding = {
  $source: string
  kind: SettingKind
  fallback?: unknown
}

export type SourceGroup =
  | 'product'
  | 'product_metafields'
  | 'collection'
  | 'collection_metafields'
  | 'shop'
  | 'metaobject'

/**
 * One entry of the picker. Fixed fields carry no `label`: the admin names them
 * from its own copy by path. Metafields and metaobject fields carry the name the
 * merchant gave them, and metaobject fields the entry (`group`'s heading) too.
 */
export type SourceOption = {
  path: string
  type: SourceType
  group: SourceGroup
  label?: string | undefined
  /** For metaobject fields: the entry's display name and its definition's name. */
  entry?: string | undefined
  definition?: string | undefined
}

/** A loaded value and its type, keyed by source path (see `loadSourceValues`). */
export type SourceValues = Record<string, { type: SourceType; value: unknown }>

/**
 * Which source types each setting kind accepts. The picker lists only these, and
 * Save refuses anything else. Numbers, prices and dates read fine as text; a colour
 * setting takes single line text and uses it only when it is a real CSS colour.
 */
export const COMPATIBLE: Record<SettingKind, readonly SourceType[]> = {
  text: [
    'single_line_text',
    'multi_line_text',
    'number_integer',
    'number_decimal',
    'money',
    'date',
    'url',
  ],
  richtext: ['rich_text', 'single_line_text', 'multi_line_text'],
  image: ['file'],
  link: ['url', 'product_reference', 'collection_reference'],
  url: ['url', 'product_reference', 'collection_reference'],
  number: ['number_integer', 'number_decimal'],
  color: ['single_line_text'],
}

export const isCompatible = (kind: SettingKind, type: SourceType): boolean =>
  COMPATIBLE[kind].includes(type)

export function isBinding(value: unknown): value is Binding {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { $source?: unknown }).$source === 'string'
  )
}

const isSettingKind = (v: unknown): v is SettingKind =>
  typeof v === 'string' && (SETTING_KINDS as readonly string[]).includes(v)

/** A binding for `path`, keeping the current value as the fallback. */
export function connect(path: string, kind: SettingKind, current: unknown): Binding {
  const fallback = isBinding(current) ? current.fallback : current
  return fallback === undefined ? { $source: path, kind } : { $source: path, kind, fallback }
}

/** Disconnecting puts the typed-in value back. */
export const disconnect = (binding: Binding): unknown => binding.fallback

// Source paths

/** The fixed fields every product and collection offers, and the store's own. */
export const PRODUCT_SOURCE_FIELDS = {
  title: 'single_line_text',
  price: 'money',
  compare_at_price: 'money',
  vendor: 'single_line_text',
  type: 'single_line_text',
  category: 'single_line_text',
  description: 'rich_text',
  featured_image: 'file',
  'images.1': 'file',
  'images.2': 'file',
  'images.3': 'file',
  url: 'url',
} as const satisfies Record<string, SourceType>

export const COLLECTION_SOURCE_FIELDS = {
  title: 'single_line_text',
  description: 'rich_text',
  image: 'file',
  url: 'url',
} as const satisfies Record<string, SourceType>

export const SHOP_SOURCE_FIELDS = {
  name: 'single_line_text',
  logo: 'file',
  email: 'single_line_text',
  phone: 'single_line_text',
  address: 'multi_line_text',
} as const satisfies Record<string, SourceType>

export type ProductSourceField = keyof typeof PRODUCT_SOURCE_FIELDS
export type CollectionSourceField = keyof typeof COLLECTION_SOURCE_FIELDS
export type ShopSourceField = keyof typeof SHOP_SOURCE_FIELDS

export type SourcePath =
  | { scope: 'product'; field: ProductSourceField }
  | { scope: 'collection'; field: CollectionSourceField }
  | { scope: 'product' | 'collection'; namespace: string; key: string }
  | { scope: 'shop'; field: ShopSourceField }
  | { scope: 'metaobject'; type: string; handle: string; key: string }

const KEY = /^[a-z][a-z0-9_]{0,63}$/
const HANDLE = /^[a-z0-9][a-z0-9-]{0,199}$/

const has = <T extends object>(table: T, k: string): k is Extract<keyof T, string> =>
  Object.hasOwn(table, k)

/** Parse a source path, or null when it is not one we know how to read. */
export function parseSourcePath(path: string): SourcePath | null {
  if (typeof path !== 'string' || path.length > 300) return null
  const parts = path.split('.')
  const [head, ...rest] = parts
  if (head === 'product' || head === 'collection') {
    if (rest[0] === 'metafields') {
      const [, namespace, key] = rest
      if (rest.length !== 3 || !namespace || !key || !KEY.test(namespace) || !KEY.test(key)) {
        return null
      }
      return { scope: head, namespace, key }
    }
    const field = rest.join('.')
    if (head === 'product') return has(PRODUCT_SOURCE_FIELDS, field) ? { scope: head, field } : null
    return has(COLLECTION_SOURCE_FIELDS, field) ? { scope: head, field } : null
  }
  if (head === 'shop') {
    const field = rest.join('.')
    return has(SHOP_SOURCE_FIELDS, field) ? { scope: 'shop', field } : null
  }
  if (head === 'metaobjects') {
    const [type, handle, key] = rest
    if (rest.length !== 3 || !type || !handle || !key) return null
    if (!KEY.test(type) || !HANDLE.test(handle) || !KEY.test(key)) return null
    return { scope: 'metaobject', type, handle, key }
  }
  return null
}

/** The type of a fixed field; null for metafields and metaobject fields (their definition says). */
export function fixedSourceType(parsed: SourcePath): SourceType | null {
  if ('field' in parsed) {
    if (parsed.scope === 'product') return PRODUCT_SOURCE_FIELDS[parsed.field]
    if (parsed.scope === 'collection') return COLLECTION_SOURCE_FIELDS[parsed.field]
    return SHOP_SOURCE_FIELDS[parsed.field]
  }
  return null
}

/**
 * Which scopes a template can read. Product data only exists on product pages and
 * collection data on collection pages; the store and metaobject entries are
 * readable everywhere, the header and footer included.
 */
export function scopeAllowed(template: string, scope: SourcePath['scope']): boolean {
  if (scope === 'product') return template === 'product'
  if (scope === 'collection') return template === 'collection'
  return true
}

// Walking template data

export type FoundBinding = {
  /** Section type (`ImageBanner`), or `root` for the template's own props. */
  section: string
  /** Where inside the section's props: `['slides', 0, 'heading']`. */
  at: (string | number)[]
  binding: Binding
}

function walk(value: unknown, section: string, at: (string | number)[], out: FoundBinding[]) {
  if (isBinding(value)) {
    out.push({ section, at, binding: value })
    return
  }
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) walk(item, section, [...at, i], out)
    return
  }
  if (typeof value === 'object' && value !== null) {
    // A block nested in a slot (`{ type, props }` inside a Group's content, a tab's
    // panel): its settings are named after it, not after the section around it.
    const nested = value as { type?: unknown; props?: unknown }
    if (typeof nested.type === 'string' && typeof nested.props === 'object' && nested.props) {
      walk(nested.props, nested.type, [], out)
      return
    }
    for (const [k, v] of Object.entries(value)) walk(v, section, [...at, k], out)
  }
}

type DataLike = {
  root?: { props?: Record<string, unknown> | undefined } | undefined
  content?: readonly { type: string; props: Record<string, unknown> }[] | undefined
  zones?: Record<string, unknown> | undefined
}

/** Every binding in a template: its root, sections and any nested zones. */
function collectBindings(data: DataLike): FoundBinding[] {
  const out: FoundBinding[] = []
  walk(data.root?.props ?? {}, 'root', [], out)
  for (const item of data.content ?? []) walk(item.props, item.type, [], out)
  for (const zone of Object.values(data.zones ?? {})) {
    if (!Array.isArray(zone)) continue
    for (const item of zone as { type?: unknown; props?: unknown }[]) {
      walk(item?.props, typeof item?.type === 'string' ? item.type : 'section', [], out)
    }
  }
  return out
}

/** Distinct source paths a template reads, for the loader. */
export const boundPaths = (data: DataLike): string[] => [
  ...new Set(collectBindings(data).map((b) => b.binding.$source)),
]

/** `ImageBanner` → `Image banner`, for messages that name a section. */
const sectionName = (type: string) =>
  type === 'root'
    ? 'Page settings'
    : type
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/ ([A-Z])/g, (_, c: string) => ` ${c.toLowerCase()}`)

const settingName = (at: (string | number)[]) =>
  at
    .filter((p): p is string => typeof p === 'string' && p !== 'settings' && p !== 'style')
    .at(-1) ?? 'a setting'

/**
 * Why a template's bindings cannot be saved; empty when they can. Without
 * `catalog` only the shape, the scope and fixed-field types are checked (drafts);
 * with it, every source must exist in this store and fit its setting (Save).
 */
export function bindingProblems(
  data: DataLike,
  template: string,
  catalog?: ReadonlyMap<string, SourceType>,
): string[] {
  const problems: string[] = []
  for (const { section, at, binding } of collectBindings(data)) {
    const where = `${sectionName(section)} › ${settingName(at)}`
    const parsed = parseSourcePath(binding.$source)
    if (!parsed || !isSettingKind(binding.kind)) {
      problems.push(`${where} is connected to an unknown source (${String(binding.$source)})`)
      continue
    }
    if (!scopeAllowed(template, parsed.scope)) {
      problems.push(`${where} reads ${binding.$source}, which this template does not have`)
      continue
    }
    const type = catalog ? catalog.get(binding.$source) : fixedSourceType(parsed)
    if (catalog && type === undefined) {
      problems.push(`${where} is connected to ${binding.$source}, which no longer exists`)
      continue
    }
    if (type && !isCompatible(binding.kind, type)) {
      problems.push(`${where} cannot show ${binding.$source} (wrong type)`)
    }
  }
  return problems
}

// Resolving

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const COLOUR =
  /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\([0-9.,%\s/+-]+\)|[a-z]{3,20})$/i

function formatDate(s: string): string {
  const m = DATE.exec(s)
  if (!m) return s
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return date.toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const asRecord = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

const safeUrl = (s: unknown): string | null =>
  typeof s === 'string' && (/^https?:\/\//i.test(s) || /^\/(?!\/)/.test(s)) ? s : null

const referenceHref = (type: SourceType, v: unknown): string | null => {
  const handle = asRecord(v).handle
  if (typeof handle !== 'string' || !handle) return null
  if (type === 'product_reference') return `/products/${handle}`
  if (type === 'collection_reference') return `/collections/${handle}`
  return null
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
): unknown {
  if (isEmpty(value) || Array.isArray(value) || !isCompatible(kind, type)) return undefined
  switch (kind) {
    case 'text': {
      if (type === 'money') return typeof value === 'number' ? formatMoney(value, 'INR') : undefined
      if (type === 'date') return typeof value === 'string' ? formatDate(value) : undefined
      if (typeof value === 'number') return String(value)
      return typeof value === 'string' ? value : undefined
    }
    case 'richtext':
      return typeof value === 'string' || asRecord(value).root ? value : undefined
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value)
      return Number.isFinite(n) ? n : undefined
    }
    case 'color':
      return typeof value === 'string' && COLOUR.test(value.trim()) ? value.trim() : undefined
    case 'image': {
      const img = asRecord(value)
      const url = safeUrl(img.url)
      if (!url) return undefined
      const alt = typeof img.alt === 'string' && img.alt ? img.alt : asRecord(fallback).alt
      return { ...asRecord(fallback), url, alt: alt ?? '' }
    }
    case 'url': {
      const href = type === 'url' ? safeUrl(value) : referenceHref(type, value)
      return href ?? undefined
    }
    case 'link': {
      const href = type === 'url' ? safeUrl(value) : referenceHref(type, value)
      if (!href) return undefined
      const base = asRecord(fallback)
      const title = asRecord(value).title
      const label =
        typeof base.label === 'string' && base.label
          ? base.label
          : typeof title === 'string'
            ? title
            : ''
      return { ...base, label, href }
    }
  }
}

/** The value a binding renders: the source when it has one, else the typed-in fallback. */
function resolveBinding(binding: Binding, values: SourceValues): unknown {
  const loaded = values[binding.$source]
  const resolved =
    loaded && isSettingKind(binding.kind)
      ? coerceValue(binding.kind, loaded.type, loaded.value, binding.fallback)
      : undefined
  return resolved !== undefined ? resolved : binding.fallback
}

function replace(value: unknown, values: SourceValues): unknown {
  if (isBinding(value)) return resolveBinding(value, values)
  if (Array.isArray(value)) return value.map((v) => replace(v, values))
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      const next = replace(v, values)
      // An empty source with nothing typed in leaves the key out, so defaults apply.
      if (next !== undefined) out[k] = next
    }
    return out
  }
  return value
}

/**
 * Template data with every binding swapped for its value (or fallback). Pass no
 * values to get the typed-in fallbacks only, which is what code that cannot load
 * sources (resolveData in the editor) should see.
 */
export function applyBindings<T>(data: T, values: SourceValues = {}): T {
  return replace(data, values) as T
}
