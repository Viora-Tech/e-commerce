/** SOURCE OF TRUTH: custom data in Shopify's Liquid shape — WHAT: `resource.metafields.<namespace>.<key>` (a metafield with a typed `.value`, `.type` and Shopify-like printing) over our extra fields, and `metaobjects.<type>` / `shop.metaobjects.<type>` (`.values`, `[handle]`, fields, `system`) over our content types and entries / WHY: imported themes keep their custom data (spec tables, roadmaps, feature rows, menu images) on metafields and metaobjects; the Shopify importer already copied that data into extra fields and content types, so the theme reads it from there instead of rendering blank */
import { Drop } from 'liquidjs'
import { keyFromName } from '../metaobjects/validate'
import type { LiquidDataCache } from './cache'
import {
  ColorDrop,
  ImageDrop,
  type LiquidFieldData,
  type LiquidFieldRef,
  type LiquidFileData,
  type LiquidMetafieldOwner,
  type LiquidMetaobjectData,
} from './drops'
import { numericId } from './numeric-id'
import { ArticleDrop, CollectionDrop, PageDrop, ProductDrop, VariantDrop } from './resource-drops'

/**
 * Shopify keys and namespaces allow `-` and capitals; the importer stored ours as lower
 * snake case through the same function, so a theme's `custom['size-guide']` finds
 * `custom.size_guide`.
 */
const localKey = (key: string): string => keyFromName(key)

/** Shopify's type name for one of our field types (`list.` added for lists). */
const SHOPIFY_TYPE: Record<string, string> = {
  single_line_text: 'single_line_text_field',
  multi_line_text: 'multi_line_text_field',
  rich_text: 'rich_text_field',
  choice: 'single_line_text_field',
  file: 'file_reference',
  group: 'json',
}
const MEASURE_TYPE = { weight: 'weight', length: 'dimension', volume: 'volume' } as const

function shopifyFieldType(field: Pick<LiquidFieldData, 'type' | 'list' | 'measure'>) {
  const base =
    field.type === 'measurement'
      ? MEASURE_TYPE[field.measure ?? 'weight']
      : (SHOPIFY_TYPE[field.type] ?? field.type)
  return field.list ? `list.${base}` : base
}

/** Shopify's resource names in `gid://shopify/<Name>/<id>`, which is how a reference prints. */
const GID_NAME: Record<LiquidFieldRef['kind'], string> = {
  file: 'MediaImage',
  product: 'Product',
  collection: 'Collection',
  page: 'Page',
  article: 'Article',
  variant: 'ProductVariant',
  metaobject: 'Metaobject',
}

const record = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null

const isRef = (v: unknown): v is LiquidFieldRef =>
  typeof record(v)?.kind === 'string' && typeof record(v)?.id === 'string'

const isImage = (f: LiquidFileData) =>
  f.contentType
    ? f.contentType.startsWith('image/')
    : /\.(avif|gif|jpe?g|png|svg|webp)(\?|$)/i.test(f.url)

/** A file field pointing at something that is not an image (a PDF, a manual). */
class GenericFileDrop extends Drop {
  readonly id: number | string
  readonly url: string
  readonly alt: string
  readonly media_type = 'generic_file'
  readonly preview_image = null
  constructor(file: LiquidFileData) {
    super()
    this.id = numericId(file.id)
    this.url = file.url
    this.alt = file.alt ?? ''
  }
  override valueOf(): string {
    return this.url
  }
}

/** A money value: `| money` reads it in subunits (paise), as Shopify's does. */
class MoneyValueDrop extends Drop {
  readonly amount: number
  readonly currency: { iso_code: string }
  readonly #subunits: number
  constructor(v: { amount: number; currency: string }) {
    super()
    this.#subunits = v.amount
    this.amount = v.amount / 100
    this.currency = { iso_code: v.currency }
  }
  override valueOf(): number {
    return this.#subunits
  }
}

/** A rating (`.value.rating`, `.scale_min`, `.scale_max`). */
class RatingValueDrop extends Drop {
  readonly rating: number
  readonly value: number
  readonly scale_min = 0
  readonly scale_max: number
  constructor(v: { value: number; max: number }) {
    super()
    this.rating = v.value
    this.value = v.value
    this.scale_max = v.max
  }
  override valueOf(): number {
    return this.rating
  }
}

/** A weight, length (Shopify's dimension) or volume: prints as `1.5 kg`. */
class MeasurementValueDrop extends Drop {
  readonly value: number
  readonly unit: string
  readonly type: string
  constructor(v: { value: number; unit: string }, type: string) {
    super()
    this.value = v.value
    this.unit = v.unit
    this.type = type
  }
  override valueOf(): string {
    return `${this.value} ${this.unit === 'fl_oz' ? 'fl oz' : this.unit}`
  }
}

/** A link (`.text`, `.url`); prints as its address. */
class LinkValueDrop extends Drop {
  readonly text: string
  readonly url: string
  constructor(v: { label?: unknown; url?: unknown }) {
    super()
    this.text = typeof v.label === 'string' ? v.label : ''
    this.url = typeof v.url === 'string' ? v.url : ''
  }
  override valueOf(): string {
    return this.url
  }
}

const fileDrop = (f: LiquidFileData) => (isImage(f) ? new ImageDrop(f) : new GenericFileDrop(f))

/** A reference as the drop Shopify gives (a product, an image...), or null until it is loaded. */
function refDrop(ref: LiquidFieldRef, cache: LiquidDataCache): unknown {
  switch (ref.kind) {
    case 'file':
      return fileDrop(ref.file)
    case 'product': {
      const p = cache.product(ref.handle)
      return p ? new ProductDrop(p, cache) : null
    }
    case 'collection': {
      const c = cache.collection(ref.handle)
      return c ? new CollectionDrop(c, cache) : null
    }
    case 'page': {
      const p = cache.page(ref.handle)
      return p ? new PageDrop(p) : null
    }
    case 'article': {
      const a = cache.blog(ref.blogHandle)?.articles.find((x) => x.handle === ref.handle)
      return a ? new ArticleDrop(a) : null
    }
    case 'variant': {
      const p = cache.product(ref.productHandle)
      const v = p?.variants.find((x) => x.id === ref.id)
      return p && v ? new VariantDrop(v, `/products/${p.handle}`, cache) : null
    }
    case 'metaobject': {
      const e = cache.metaobject(ref.id)
      return e ? new MetaobjectDrop(e, cache) : null
    }
  }
}

/** One stored item as Liquid reads it. */
function itemValue(field: LiquidFieldData, v: unknown, cache: LiquidDataCache): unknown {
  if (v === null || v === undefined) return null
  if (isRef(v)) return refDrop(v, cache)
  const r = record(v)
  switch (field.type) {
    case 'color':
      return typeof v === 'string' ? new ColorDrop(v) : null
    case 'money':
      return typeof r?.amount === 'number'
        ? new MoneyValueDrop({ amount: r.amount, currency: String(r.currency ?? 'INR') })
        : null
    case 'rating':
      return typeof r?.value === 'number'
        ? new RatingValueDrop({ value: r.value, max: Number(r.max ?? 5) })
        : null
    case 'measurement':
      return typeof r?.value === 'number' && typeof r.unit === 'string'
        ? new MeasurementValueDrop({ value: r.value, unit: r.unit }, shopifyFieldType(field))
        : null
    case 'link':
      return r ? new LinkValueDrop(r) : null
    case 'group':
      // Rows of plain values; files picked in a row read as images.
      return Array.isArray(v)
        ? v.map((row) =>
            Object.fromEntries(
              Object.entries(record(row) ?? {}).map(([k, x]) => [
                k,
                isRef(x) ? refDrop(x, cache) : x,
              ]),
            ),
          )
        : null
    default:
      return v
  }
}

/** The field's `.value`: one item, or the list with anything not loaded or hidden left out. */
function fieldValue(field: LiquidFieldData, cache: LiquidDataCache): unknown {
  if (field.list && Array.isArray(field.value)) {
    return field.value.map((v) => itemValue(field, v, cache)).filter((v) => v != null)
  }
  return itemValue(field, field.value, cache)
}

/** How Shopify prints one stored item when the metafield itself is output. */
function printItem(field: LiquidFieldData, v: unknown): unknown {
  if (isRef(v)) return `gid://shopify/${GID_NAME[v.kind]}/${numericId(v.id)}`
  const r = record(v)
  switch (field.type) {
    case 'money':
      return JSON.stringify({
        amount: (Number(r?.amount ?? 0) / 100).toFixed(2),
        currency_code: r?.currency ?? 'INR',
      })
    case 'rating':
      return JSON.stringify({
        value: String(r?.value ?? ''),
        scale_min: '0',
        scale_max: String(r?.max ?? 5),
      })
    case 'measurement':
      return JSON.stringify({ value: r?.value, unit: r?.unit })
    case 'link':
      return JSON.stringify({ text: r?.label ?? '', url: r?.url ?? '' })
    case 'group':
      return JSON.stringify(v, (_k, x: unknown) =>
        isRef(x) ? (x.kind === 'file' ? x.file.url : printItem(field, x)) : x,
      )
    default:
      return v
  }
}

/** `{{ product.metafields.custom.x }}`: text as text, numbers as numbers, the rest as Shopify's raw value. */
function printField(field: LiquidFieldData): unknown {
  if (field.list && Array.isArray(field.value)) {
    return JSON.stringify(field.value.map((v) => printItem(field, v)))
  }
  return printItem(field, field.value)
}

/** Reads a property of a value the way Liquid would, for metafields used like their value. */
function readOf(value: unknown, key: string): unknown {
  if (value instanceof Drop) {
    const own = (value as unknown as Record<string, unknown>)[key]
    if (own !== undefined) return typeof own === 'function' ? own.call(value) : own
    return value.liquidMethodMissing(key, undefined as never)
  }
  if (Array.isArray(value)) {
    if (key === 'size') return value.length
    if (key === 'first') return value[0]
    if (key === 'last') return value[value.length - 1]
    return undefined
  }
  return record(value)?.[key]
}

/**
 * One metafield (or one field of an entry): `.value` typed like Shopify's, `.type`
 * Shopify's type name, and printed on its own like Shopify prints it. Anything else
 * reads through to the value, so `feature.image.width` works as themes expect.
 */
class MetafieldDrop extends Drop {
  readonly namespace: string
  readonly key: string
  readonly type: string
  readonly list: boolean
  readonly #field: LiquidFieldData
  readonly #cache: LiquidDataCache
  constructor(field: LiquidFieldData & { namespace: string }, cache: LiquidDataCache) {
    super()
    this.#field = field
    this.#cache = cache
    this.namespace = field.namespace
    this.key = field.key
    this.type = shopifyFieldType(field)
    this.list = field.list
  }
  get value(): unknown {
    return fieldValue(this.#field, this.#cache)
  }
  override liquidMethodMissing(key: string): unknown {
    if (key === 'list?') return this.list
    return readOf(this.value, key)
  }
  override valueOf(): unknown {
    return printField(this.#field)
  }
  override toString(): string {
    return String(this.valueOf() ?? '')
  }
}

/** Who the extra fields belong to; null for owners we keep no extra fields on (variants, pages, the shop). */
export type MetafieldOwnerRef = { type: LiquidMetafieldOwner; id: string } | null

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** One namespace of an owner's metafields (`product.metafields.custom`). */
class MetafieldNamespaceDrop extends Drop {
  readonly #namespace: string
  readonly #owner: MetafieldOwnerRef
  readonly #cache: LiquidDataCache | null
  constructor(namespace: string, owner: MetafieldOwnerRef, cache: LiquidDataCache | null) {
    super()
    this.#namespace = namespace
    this.#owner = owner
    this.#cache = cache
  }
  override liquidMethodMissing(key: string): unknown {
    if (!this.#owner || !this.#cache) return null
    const fields = this.#cache.metafields(this.#owner.type, this.#owner.id)
    const k = localKey(String(key))
    const found = fields?.find((f) => f.namespace === this.#namespace && f.key === k)
    return found ? new MetafieldDrop(found, this.#cache) : null
  }
  override valueOf(): string {
    return ''
  }
}

/** `resource.metafields`: our extra fields by namespace and key, loaded in one batch per pass. */
export class MetafieldsDrop extends Drop {
  readonly #owner: MetafieldOwnerRef
  readonly #cache: LiquidDataCache | null
  constructor(cache: LiquidDataCache | null = null, owner: MetafieldOwnerRef = null) {
    super()
    this.#cache = cache
    // Shopify's `collections.all` and other made-up resources have no extra fields.
    this.#owner = owner && UUID.test(owner.id) ? owner : null
  }
  override liquidMethodMissing(namespace: string): unknown {
    return new MetafieldNamespaceDrop(localKey(String(namespace)), this.#owner, this.#cache)
  }
}

/**
 * `shop.metafields`: we keep no extra fields on the shop, so every namespace reads blank,
 * except `judgeme`, which the Reviews app fills with Judge.me's shop data (`reviews_grid`,
 * `all_reviews_rating`, `all_reviews_count`, `trust_badge.verified_reviews_count`), each as
 * `{ value }` like a metafield, so review walls and showcases render our reviews.
 */
export class ShopMetafieldsDrop extends Drop {
  readonly #cache: LiquidDataCache
  constructor(cache: LiquidDataCache) {
    super()
    this.#cache = cache
  }
  override liquidMethodMissing(namespace: string): unknown {
    const ns = localKey(String(namespace))
    if (ns === 'judgeme') return this.#cache.judgeme()
    return new MetafieldNamespaceDrop(ns, null, null)
  }
}

/** One entry (metaobject): its fields by key, and `system` (id, handle, type). */
class MetaobjectDrop extends Drop {
  readonly system: { id: number | string; handle: string; type: string; url: null }
  readonly #entry: LiquidMetaobjectData
  readonly #cache: LiquidDataCache
  constructor(entry: LiquidMetaobjectData, cache: LiquidDataCache) {
    super()
    this.#entry = entry
    this.#cache = cache
    this.system = { id: numericId(entry.id), handle: entry.handle, type: entry.type, url: null }
  }
  override liquidMethodMissing(key: string): unknown {
    const k = localKey(String(key))
    const field = this.#entry.fields.find((f) => f.key === k)
    return field ? new MetafieldDrop({ ...field, namespace: this.#entry.type }, this.#cache) : null
  }
  /** Used as a key, an entry reads as its handle. */
  override valueOf(): string {
    return this.#entry.handle
  }
}

/** `metaobjects.<type>`: `.values` in order, `[handle]` for one entry. */
class MetaobjectTypeDrop extends Drop {
  readonly #type: string
  readonly #cache: LiquidDataCache
  constructor(type: string, cache: LiquidDataCache) {
    super()
    this.#type = type
    this.#cache = cache
  }
  get values(): MetaobjectDrop[] {
    return (this.#cache.metaobjectType(this.#type) ?? []).map(
      (e) => new MetaobjectDrop(e, this.#cache),
    )
  }
  get values_count(): number {
    return this.#cache.metaobjectType(this.#type)?.length ?? 0
  }
  override liquidMethodMissing(handle: string): unknown {
    const entry = this.#cache.metaobjectType(this.#type)?.find((e) => e.handle === String(handle))
    return entry ? new MetaobjectDrop(entry, this.#cache) : null
  }
}

/** The `metaobjects` global and `shop.metaobjects`. */
export class MetaobjectsDrop extends Drop {
  readonly #cache: LiquidDataCache
  constructor(cache: LiquidDataCache) {
    super()
    this.#cache = cache
  }
  override liquidMethodMissing(type: string): unknown {
    return new MetaobjectTypeDrop(localKey(String(type)), this.#cache)
  }
}
