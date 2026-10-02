/** SOURCE OF TRUTH: dynamic source bindings — WHAT the `{ $source, kind, fallback }` format in section settings, source paths, setting/source type compatibility, validation (value resolution: `./resolve.ts`) / WHY the editor, Save and the storefront renderer must read bindings the same way. No database. */
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

/**
 * A loaded value and its type, keyed by source path (see `loadSourceValues`). A date and
 * time carries the store's time zone, so the text reads in the store's clock.
 */
export type SourceValues = Record<
  string,
  { type: SourceType; value: unknown; timeZone?: string | undefined }
>

/** Sources that can be the target of a link or URL setting. */
const LINKABLE = [
  'url',
  'link',
  'product_reference',
  'collection_reference',
  'page_reference',
  'variant_reference',
  'article_reference',
] as const satisfies readonly SourceType[]

/**
 * Which source types each setting kind accepts. The picker lists only these, and
 * Save refuses anything else. Numbers, prices, dates, choices, ratings and
 * measurements read fine as text; a colour setting takes a colour, or single line
 * text used only when it is a real CSS colour.
 */
export const COMPATIBLE: Record<SettingKind, readonly SourceType[]> = {
  text: [
    'single_line_text',
    'multi_line_text',
    'number_integer',
    'number_decimal',
    'money',
    'date',
    'date_time',
    'url',
    'choice',
    'rating',
    'measurement',
  ],
  richtext: ['rich_text', 'single_line_text', 'multi_line_text'],
  image: ['file'],
  link: [...LINKABLE],
  url: [...LINKABLE],
  number: ['number_integer', 'number_decimal', 'rating'],
  color: ['color', 'single_line_text'],
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

export const isSettingKind = (v: unknown): v is SettingKind =>
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

/**
 * Template data is plain JSON once saved, but the editor's live data can hold
 * things that aren't: React elements (rich text rendered for the canvas, with an
 * `_owner` that points back up the tree) and objects shared or nested in a loop.
 * Bindings only ever live in plain objects and arrays, so the walk skips the rest
 * and never visits the same object twice.
 */
export function isPlainData(value: object): boolean {
  if ('$$typeof' in value) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null || Array.isArray(value)
}

function walk(
  value: unknown,
  section: string,
  at: (string | number)[],
  out: FoundBinding[],
  seen: WeakSet<object> = new WeakSet(),
) {
  if (isBinding(value)) {
    out.push({ section, at, binding: value })
    return
  }
  if (typeof value !== 'object' || value === null) return
  if (seen.has(value) || !isPlainData(value)) return
  seen.add(value)
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) walk(item, section, [...at, i], out, seen)
    return
  }
  // A block nested in a slot (`{ type, props }` inside a Group's content, a tab's
  // panel): its settings are named after it, not after the section around it.
  const nested = value as { type?: unknown; props?: unknown }
  if (typeof nested.type === 'string' && typeof nested.props === 'object' && nested.props) {
    walk(nested.props, nested.type, [], out, seen)
    return
  }
  for (const [k, v] of Object.entries(value)) walk(v, section, [...at, k], out, seen)
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
