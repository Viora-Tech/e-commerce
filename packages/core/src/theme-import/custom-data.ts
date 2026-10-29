/** SOURCE OF TRUTH: extra fields and content entries for imported themes — WHAT: batched loads of product and collection extra fields (metafields), content entries by type or id (metaobjects), and every record their values link to, in the shapes `custom-drops.ts` reads / WHY: themes read custom data on every product card and menu; one query per batch per pass (never one per product) keeps that cheap, and only storefront-visible types and published records are ever shown */
import {
  article,
  blog,
  collection,
  media,
  metafield,
  metafieldDefinition,
  metaobject,
  metaobjectDefinition,
  page,
  product,
  type StoreTx,
  variant,
} from '@commerce/db'
import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { visibleNow } from '../blog/service'
import type { FieldType, FieldValidations } from '../metaobjects/schemas'
import type {
  LiquidCustomData,
  LiquidFieldData,
  LiquidFieldRef,
  LiquidMetafieldData,
  LiquidMetafieldOwner,
  LiquidMetaobjectData,
} from './drops'
import { richTextHtml } from './rich-html'

/** How many entries of one content type a theme can loop over (the storefront's own cap). */
const METAOBJECT_TYPE_LIMIT = 250
/** Entry links followed within one load; deeper ones load on the next render pass. */
const ENTRY_DEPTH = 3

type FieldShape = {
  key: string
  type: FieldType
  list: boolean
  validations?: FieldValidations | Record<string, unknown> | null | undefined
}

type RawEntry = {
  id: string
  handle: string
  type: string
  fields: Record<string, unknown>
  shapes: FieldShape[]
}

type Kind = LiquidFieldRef['kind']

/** What each reference type links to. */
const REF_KIND: Partial<Record<FieldType, Kind>> = {
  file: 'file',
  product_reference: 'product',
  collection_reference: 'collection',
  page_reference: 'page',
  article_reference: 'article',
  variant_reference: 'variant',
  metaobject_reference: 'metaobject',
}

const rulesOf = (shape: FieldShape) => (shape.validations ?? {}) as FieldValidations

/** Group subfields that hold files. */
const rowFileKeys = (shape: FieldShape): string[] =>
  (rulesOf(shape).subfields ?? []).filter((s) => s.type === 'file').map((s) => s.key)

const asRows = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    : []

const items = (value: unknown): unknown[] => (Array.isArray(value) ? value : [value])

const isEmpty = (v: unknown) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)

/**
 * Collects the ids a set of values links to, loads them kind by kind (entries a few
 * levels deep), then turns each value into what a theme reads.
 */
class Resolver {
  readonly #tx: StoreTx
  readonly #want: Record<Kind, Set<string>> = {
    file: new Set(),
    product: new Set(),
    collection: new Set(),
    page: new Set(),
    article: new Set(),
    variant: new Set(),
    metaobject: new Set(),
  }
  /** Loaded targets by kind and id; an id tried and not found is absent but in `#tried`. */
  readonly #found = new Map<string, LiquidFieldRef>()
  readonly #tried = new Set<string>()
  readonly entries = new Map<string, RawEntry>()

  constructor(tx: StoreTx) {
    this.#tx = tx
  }

  gather(shape: FieldShape, value: unknown) {
    if (shape.type === 'group') {
      const keys = rowFileKeys(shape)
      for (const row of asRows(value)) {
        for (const key of keys) if (typeof row[key] === 'string') this.#ask('file', row[key])
      }
      return
    }
    const kind = REF_KIND[shape.type]
    if (!kind) return
    for (const v of items(value)) if (typeof v === 'string') this.#ask(kind, v)
  }

  /** Entries already read (a content type's own), so links between them need no second load. */
  addEntries(rows: RawEntry[]) {
    for (const row of rows) {
      this.entries.set(row.id, row)
      this.#tried.add(`metaobject:${row.id}`)
      this.#found.set(`metaobject:${row.id}`, { kind: 'metaobject', id: row.id })
      for (const s of row.shapes) this.gather(s, row.fields[s.key])
    }
  }

  #ask(kind: Kind, id: string) {
    if (!this.#tried.has(`${kind}:${id}`)) this.#want[kind].add(id)
  }

  #take(kind: Kind): string[] {
    const ids = [...this.#want[kind]]
    this.#want[kind].clear()
    for (const id of ids) this.#tried.add(`${kind}:${id}`)
    return ids
  }

  #keep(refs: LiquidFieldRef[]) {
    for (const r of refs) this.#found.set(`${r.kind}:${r.id}`, r)
  }

  async load() {
    for (let depth = 0; depth < ENTRY_DEPTH; depth++) {
      const ids = this.#take('metaobject')
      if (ids.length === 0) break
      this.addEntries(await loadEntries(this.#tx, { ids }))
    }
    const tx = this.#tx
    const [files, products, collections, pages, articles, variants] = await Promise.all([
      ids(this.#take('file'), (list) =>
        tx
          .select({
            id: media.id,
            url: media.url,
            alt: media.alt,
            width: media.width,
            height: media.height,
            contentType: media.contentType,
          })
          .from(media)
          .where(inArray(media.id, list)),
      ),
      ids(this.#take('product'), (list) =>
        tx
          .select({ id: product.id, handle: product.handle })
          .from(product)
          .where(and(inArray(product.id, list), eq(product.status, 'active'))),
      ),
      ids(this.#take('collection'), (list) =>
        tx
          .select({ id: collection.id, handle: collection.handle })
          .from(collection)
          .where(and(inArray(collection.id, list), eq(collection.status, 'active'))),
      ),
      ids(this.#take('page'), (list) =>
        tx
          .select({ id: page.id, handle: page.handle })
          .from(page)
          .where(and(inArray(page.id, list), isNotNull(page.publishedAt))),
      ),
      ids(this.#take('article'), (list) =>
        tx
          .select({ id: article.id, handle: article.handle, blogHandle: blog.handle })
          .from(article)
          .innerJoin(blog, eq(blog.id, article.blogId))
          .where(and(inArray(article.id, list), visibleNow(new Date()))),
      ),
      ids(this.#take('variant'), (list) =>
        tx
          .select({ id: variant.id, productHandle: product.handle })
          .from(variant)
          .innerJoin(product, eq(product.id, variant.productId))
          .where(
            and(
              inArray(variant.id, list),
              isNull(variant.archivedAt),
              eq(variant.hiddenOnStore, false),
              eq(product.status, 'active'),
            ),
          ),
      ),
    ])
    this.#keep(files.map((f) => ({ kind: 'file', id: f.id, file: f })))
    this.#keep(products.map((p) => ({ kind: 'product', ...p })))
    this.#keep(collections.map((c) => ({ kind: 'collection', ...c })))
    this.#keep(pages.map((p) => ({ kind: 'page', ...p })))
    this.#keep(articles.map((a) => ({ kind: 'article', ...a })))
    this.#keep(variants.map((v) => ({ kind: 'variant', ...v })))
  }

  /**
   * A link as a theme reads it: the loaded target, null when it is hidden or gone. An
   * entry link past the depth followed here stays a link the request cache loads later.
   */
  #ref(kind: Kind, id: unknown): LiquidFieldRef | null {
    if (typeof id !== 'string') return null
    const found = this.#found.get(`${kind}:${id}`)
    if (found) return found
    return kind === 'metaobject' && !this.#tried.has(`${kind}:${id}`)
      ? { kind: 'metaobject', id }
      : null
  }

  /** One stored value as a theme reads it. */
  convert(shape: FieldShape, value: unknown): unknown {
    if (shape.type === 'group') {
      const keys = rowFileKeys(shape)
      return asRows(value).map((row) => {
        const out = { ...row }
        for (const key of keys) if (key in out) out[key] = this.#ref('file', out[key])
        return out
      })
    }
    if (shape.type === 'rich_text') return richTextHtml(value) || null
    const kind = REF_KIND[shape.type]
    if (kind) {
      return Array.isArray(value)
        ? value.map((v) => this.#ref(kind, v)).filter(Boolean)
        : this.#ref(kind, value)
    }
    return value
  }

  field(shape: FieldShape, value: unknown): LiquidFieldData | null {
    const converted = value === undefined ? null : this.convert(shape, value)
    if (isEmpty(converted)) return null
    const measure = rulesOf(shape).measure ?? null
    return { key: shape.key, type: shape.type, list: shape.list, measure, value: converted }
  }

  /** Every entry read, its fields converted. */
  entryList(): LiquidMetaobjectData[] {
    return [...this.entries.values()].map((e) => ({
      id: e.id,
      handle: e.handle,
      type: e.type,
      fields: e.shapes.flatMap((s) => this.field(s, e.fields[s.key]) ?? []),
    }))
  }
}

/** Runs a query only when there is something to ask for. */
async function ids<T>(list: string[], query: (list: string[]) => Promise<T[]>): Promise<T[]> {
  return list.length ? query(list) : []
}

/** Published entries of storefront-visible content types, by id or by type. */
async function loadEntries(
  tx: StoreTx,
  by: { ids: string[] } | { type: string },
): Promise<RawEntry[]> {
  const rows = await tx
    .select({
      id: metaobject.id,
      handle: metaobject.handle,
      fields: metaobject.fields,
      type: metaobjectDefinition.type,
      shapes: metaobjectDefinition.fields,
    })
    .from(metaobject)
    .innerJoin(metaobjectDefinition, eq(metaobjectDefinition.id, metaobject.definitionId))
    .where(
      and(
        'ids' in by ? inArray(metaobject.id, by.ids) : eq(metaobjectDefinition.type, by.type),
        eq(metaobject.status, 'active'),
        eq(metaobjectDefinition.storefrontAccess, true),
      ),
    )
    .orderBy(asc(metaobject.createdAt), asc(metaobject.id))
    .limit('ids' in by ? by.ids.length : METAOBJECT_TYPE_LIMIT)
  return rows.map((r) => ({ ...r, shapes: r.shapes as FieldShape[] }))
}

/** Extra fields of many products (or collections) in one query, links resolved. */
export async function loadMetafields(
  tx: StoreTx,
  ownerType: LiquidMetafieldOwner,
  ownerIds: string[],
): Promise<LiquidCustomData> {
  if (ownerIds.length === 0) return { metafields: {}, entries: [] }
  const rows = await tx
    .select({
      ownerId: metafield.ownerId,
      namespace: metafieldDefinition.namespace,
      key: metafieldDefinition.key,
      type: metafieldDefinition.type,
      list: metafieldDefinition.list,
      validations: metafieldDefinition.validations,
      value: metafield.value,
    })
    .from(metafield)
    .innerJoin(metafieldDefinition, eq(metafieldDefinition.id, metafield.definitionId))
    .where(
      and(
        eq(metafield.ownerType, ownerType),
        inArray(metafield.ownerId, ownerIds),
        eq(metafieldDefinition.storefrontAccess, true),
      ),
    )
    .orderBy(asc(metafieldDefinition.position))
  const resolver = new Resolver(tx)
  for (const r of rows) resolver.gather(r, r.value)
  await resolver.load()
  const metafields: Record<string, LiquidMetafieldData[]> = {}
  for (const r of rows) {
    const field = resolver.field(r, r.value)
    if (!field) continue
    const list = metafields[r.ownerId] ?? []
    list.push({ ...field, namespace: r.namespace })
    metafields[r.ownerId] = list
  }
  return { metafields, entries: resolver.entryList() }
}

/** Every published entry of one content type (first in the result, in order), links resolved. */
export async function loadMetaobjectsOfType(tx: StoreTx, type: string): Promise<LiquidCustomData> {
  const resolver = new Resolver(tx)
  resolver.addEntries(await loadEntries(tx, { type }))
  await resolver.load()
  return { metafields: {}, entries: resolver.entryList() }
}

/** Published entries by id, links resolved. */
export async function loadMetaobjects(tx: StoreTx, entryIds: string[]): Promise<LiquidCustomData> {
  if (entryIds.length === 0) return { metafields: {}, entries: [] }
  const resolver = new Resolver(tx)
  resolver.addEntries(await loadEntries(tx, { ids: entryIds }))
  await resolver.load()
  return { metafields: {}, entries: resolver.entryList() }
}
