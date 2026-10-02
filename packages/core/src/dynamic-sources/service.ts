/** SOURCE OF TRUTH: dynamic source loading — WHAT the per-store catalog and per-request source values (product, collection, store, metaobjects) under RLS, and Save's binding check / WHY connected theme settings resolve server side from live data. */
import {
  collection,
  media,
  metafieldDefinition,
  metaobject,
  metaobjectDefinition,
  product,
  productMedia,
  type StoreTx,
  store,
  variant,
} from '@commerce/db'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import type { FieldType } from '../metaobjects/schemas'
import { metaobjectByHandle, typedMetafieldsFor } from '../metaobjects/storefront'
import { entryDisplayName } from '../metaobjects/validate'
import { liveThemeSettings } from '../theme/library'
import { buildSourceCatalog, catalogTypes } from './catalog'
import {
  bindingProblems,
  fixedSourceType,
  parseSourcePath,
  type SourceOption,
  type SourcePath,
  type SourceType,
  type SourceValues,
} from './format'

/**
 * Dynamic sources on the server: what a template can connect to, and the values
 * of the sources a template reads for one request. Everything runs on the
 * caller's `StoreTx`, so row-level security keeps it to the current store, and
 * only storefront-visible definitions and active entries are served.
 */

/** Entries per metaobject definition offered in the picker. */
const ENTRIES_PER_DEFINITION = 100

/** Every source the template can connect to, for the editor's picker and for Save. */
export async function loadSourceCatalog(tx: StoreTx, template: string): Promise<SourceOption[]> {
  const [fieldDefs, objectDefs] = await Promise.all([
    tx
      .select({
        ownerType: metafieldDefinition.ownerType,
        namespace: metafieldDefinition.namespace,
        key: metafieldDefinition.key,
        name: metafieldDefinition.name,
        type: metafieldDefinition.type,
        list: metafieldDefinition.list,
      })
      .from(metafieldDefinition)
      .where(eq(metafieldDefinition.storefrontAccess, true))
      .orderBy(asc(metafieldDefinition.position), asc(metafieldDefinition.name)),
    tx
      .select()
      .from(metaobjectDefinition)
      .where(eq(metaobjectDefinition.storefrontAccess, true))
      .orderBy(asc(metaobjectDefinition.name)),
  ])
  const entries = objectDefs.length
    ? await tx
        .select({
          definitionId: metaobject.definitionId,
          handle: metaobject.handle,
          fields: metaobject.fields,
        })
        .from(metaobject)
        .where(
          and(
            inArray(
              metaobject.definitionId,
              objectDefs.map((d) => d.id),
            ),
            eq(metaobject.status, 'active'),
          ),
        )
        .orderBy(asc(metaobject.createdAt))
    : []
  return buildSourceCatalog(template, {
    productMetafields: fieldDefs.filter((d) => d.ownerType === 'product'),
    collectionMetafields: fieldDefs.filter((d) => d.ownerType === 'collection'),
    metaobjects: objectDefs.map((def) => ({
      type: def.type,
      name: def.name,
      fields: def.fields,
      entries: entries
        .filter((e) => e.definitionId === def.id)
        .slice(0, ENTRIES_PER_DEFINITION)
        .map((e) => ({
          handle: e.handle,
          displayName: entryDisplayName(def.displayNameKey, e.fields, e.handle),
        })),
    })),
  })
}

/** Thrown by Save when a template reads a source it cannot have. */
export class InvalidBindings extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super(problems.join('. '))
    this.name = 'InvalidBindings'
    this.problems = problems
  }
}

type TemplateLike = Parameters<typeof bindingProblems>[0]

/**
 * Save's check: every connected setting reads a source this store has, that its
 * template may read, and of a type the setting can show. Only loads the catalog
 * when the templates hold a binding at all.
 */
export async function assertTemplateBindings(
  tx: StoreTx,
  templates: readonly { template: string; data: TemplateLike }[],
): Promise<void> {
  const problems: string[] = []
  const catalogs = new Map<string, Map<string, SourceType>>()
  for (const t of templates) {
    if (!hasBinding(t.data)) continue
    let types = catalogs.get(t.template)
    if (!types) {
      types = catalogTypes(await loadSourceCatalog(tx, t.template))
      catalogs.set(t.template, types)
    }
    problems.push(...bindingProblems(t.data, t.template, types))
  }
  if (problems.length) throw new InvalidBindings(problems)
}

const hasBinding = (data: TemplateLike) => JSON.stringify(data).includes('"$source"')

/** The resource a request renders: the product or collection page's own record. */
export type SourceScope = {
  storeId: string
  productId?: string | null | undefined
  collectionId?: string | null | undefined
}

let taxonomy: Promise<Map<string, string>> | null = null

/** A category id's own name (`Shirts`), from the vendored Shopify taxonomy, loaded once. */
async function categoryName(id: string): Promise<string | null> {
  taxonomy ??= import('../catalog/product-taxonomy.json').then(
    (mod) => new Map((mod.default as unknown as [string, string][]).map(([k, v]) => [k, v])),
  )
  return (await taxonomy).get(id) ?? null
}

const addressText = (raw: unknown): string | null => {
  const a = (raw ?? {}) as Record<string, unknown>
  const line = (...keys: string[]) =>
    keys
      .map((k) => a[k])
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
      .join(', ')
  const lines = [line('line1'), line('line2'), line('city', 'state', 'pincode')].filter(Boolean)
  return lines.length ? lines.join('\n') : null
}

async function productValues(tx: StoreTx, productId: string, fields: Set<string>) {
  const out: Record<string, unknown> = {}
  const [row] = await tx.select().from(product).where(eq(product.id, productId))
  if (!row) return out
  out.title = row.title
  out.vendor = row.vendor
  out.type = row.productType
  out.description = row.description
  out.url = `/products/${row.handle}`
  if (fields.has('category')) {
    out.category = row.categoryId ? await categoryName(row.categoryId) : null
  }
  if (fields.has('price') || fields.has('compare_at_price')) {
    const variants = await tx
      .select({ price: variant.pricePaise, mrp: variant.mrpPaise })
      .from(variant)
      .where(and(eq(variant.productId, productId), isNull(variant.archivedAt)))
      .orderBy(asc(variant.position))
    const cheapest = variants.reduce<(typeof variants)[number] | null>(
      (best, v) => (!best || v.price < best.price ? v : best),
      null,
    )
    const now = Date.now()
    const onSale =
      (!row.saleStartsAt || row.saleStartsAt.getTime() <= now) &&
      (!row.saleEndsAt || row.saleEndsAt.getTime() > now)
    out.price = cheapest?.price ?? null
    out.compare_at_price =
      cheapest?.mrp && cheapest.mrp > cheapest.price && onSale ? cheapest.mrp : null
  }
  if ([...fields].some((f) => f === 'featured_image' || f.startsWith('images.'))) {
    const images = await tx
      .select({ url: media.url, alt: media.alt })
      .from(productMedia)
      .innerJoin(media, eq(media.id, productMedia.mediaId))
      .where(eq(productMedia.productId, productId))
      .orderBy(asc(productMedia.position))
    const image = (i: number) =>
      images[i] ? { url: images[i].url, alt: images[i].alt ?? row.title } : null
    out.featured_image = image(0)
    for (const i of [1, 2, 3]) out[`images.${i}`] = image(i)
  }
  return out
}

async function collectionValues(tx: StoreTx, collectionId: string) {
  const [row] = await tx
    .select({
      handle: collection.handle,
      title: collection.title,
      description: collection.description,
      url: media.url,
      alt: media.alt,
    })
    .from(collection)
    .leftJoin(media, eq(media.id, collection.imageMediaId))
    .where(eq(collection.id, collectionId))
  if (!row) return {}
  return {
    title: row.title,
    description: row.description,
    url: `/collections/${row.handle}`,
    image: row.url ? { url: row.url, alt: row.alt ?? row.title } : null,
  }
}

async function shopValues(tx: StoreTx, storeId: string, fields: Set<string>) {
  const [row] = await tx.select().from(store).where(eq(store.id, storeId))
  if (!row) return {}
  const out: Record<string, unknown> = {
    name: row.name,
    email: row.contactEmail,
    phone: row.contactPhone,
    address: addressText(row.address),
  }
  if (fields.has('logo')) {
    const logo = (await liveThemeSettings(tx, storeId)).brand.logo
    out.logo = logo ? { url: logo.url, alt: row.name } : null
  }
  return out
}

async function metaobjectValues(
  tx: StoreTx,
  wanted: Extract<SourcePath, { scope: 'metaobject' }>[],
  values: SourceValues,
) {
  const types = [...new Set(wanted.map((w) => w.type))]
  const defs = await tx
    .select({ type: metaobjectDefinition.type, fields: metaobjectDefinition.fields })
    .from(metaobjectDefinition)
    .where(
      and(
        inArray(metaobjectDefinition.type, types),
        eq(metaobjectDefinition.storefrontAccess, true),
      ),
    )
  const fieldTypes = new Map(
    defs.flatMap((d) => d.fields.map((f) => [`${d.type}.${f.key}`, f.type as FieldType] as const)),
  )
  const entries = new Map<string, Awaited<ReturnType<typeof metaobjectByHandle>>>()
  for (const w of wanted) {
    const id = `${w.type}.${w.handle}`
    if (!entries.has(id)) entries.set(id, await metaobjectByHandle({ tx }, w.type, w.handle))
    const type = fieldTypes.get(`${w.type}.${w.key}`)
    const entry = entries.get(id)
    if (type && entry) {
      values[`metaobjects.${w.type}.${w.handle}.${w.key}`] = { type, value: entry.fields[w.key] }
    }
  }
}

/**
 * The values of the given source paths for one request. A path the scope cannot
 * answer (product data without a product, a deleted metafield, a hidden
 * metaobject) is simply absent, and its setting renders its fallback.
 */
export async function loadSourceValues(
  tx: StoreTx,
  paths: readonly string[],
  scope: SourceScope,
): Promise<SourceValues> {
  const values: SourceValues = {}
  const parsed = paths.flatMap((path) => {
    const p = parseSourcePath(path)
    return p ? [{ path, p }] : []
  })
  if (!parsed.length) return values

  const fixedOf = (scopeName: SourcePath['scope']) =>
    new Set(parsed.flatMap(({ p }) => (p.scope === scopeName && 'field' in p ? [p.field] : [])))
  const wantsMetafields = (scopeName: 'product' | 'collection') =>
    parsed.some(({ p }) => p.scope === scopeName && 'namespace' in p)

  const setFixed = (prefix: string, loaded: Record<string, unknown>) => {
    for (const { path, p } of parsed) {
      if (!path.startsWith(`${prefix}.`) || !('field' in p)) continue
      const type = fixedSourceType(p)
      if (type && p.field in loaded) values[path] = { type, value: loaded[p.field] }
    }
  }
  const setMetafields = (prefix: string, rows: Awaited<ReturnType<typeof typedMetafieldsFor>>) => {
    for (const r of rows) {
      values[`${prefix}.metafields.${r.namespace}.${r.key}`] = { type: r.type, value: r.value }
    }
  }

  const product = fixedOf('product')
  if (scope.productId && product.size) {
    setFixed('product', await productValues(tx, scope.productId, product))
  }
  if (scope.productId && wantsMetafields('product')) {
    setMetafields('product', await typedMetafieldsFor({ tx }, 'product', scope.productId))
  }
  if (scope.collectionId && fixedOf('collection').size) {
    setFixed('collection', await collectionValues(tx, scope.collectionId))
  }
  if (scope.collectionId && wantsMetafields('collection')) {
    setMetafields('collection', await typedMetafieldsFor({ tx }, 'collection', scope.collectionId))
  }
  const shop = fixedOf('shop')
  if (shop.size) setFixed('shop', await shopValues(tx, scope.storeId, shop))
  const objects = parsed.flatMap(({ p }) => (p.scope === 'metaobject' ? [p] : []))
  if (objects.length) await metaobjectValues(tx, objects, values)

  // Only what was asked for: a page's other metafields stay out of the result.
  const asked = new Set(paths)
  for (const key of Object.keys(values)) if (!asked.has(key)) delete values[key]
  // A date and time reads in the store's clock.
  const timed = Object.values(values).filter((v) => v.type === 'date_time')
  if (timed.length) {
    const [row] = await tx
      .select({ timeZone: store.timezone })
      .from(store)
      .where(eq(store.id, scope.storeId))
    for (const v of timed) v.timeZone = row?.timeZone
  }
  return values
}
