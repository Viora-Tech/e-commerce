/** SOURCE OF TRUTH: list binding loading — WHAT the rows behind a template's loops (`./loops.ts`) for one request: active entries of a content type, or a collection's products, capped at 50 per list and read under RLS / WHY sections that repeat rows (FAQ, quotes, logos, people) fill from store data at render time, batched so a page with several lists makes a few queries, not one per row. */
import {
  collection,
  collectionProduct,
  media,
  metaobjectDefinition,
  product,
  productMedia,
  type StoreTx,
  variant,
} from '@commerce/db'
import { and, asc, eq, inArray, isNull, min } from 'drizzle-orm'
import type { FieldType } from '../metaobjects/schemas'
import { metaobjectsByType } from '../metaobjects/storefront'
import {
  LOOP_MAX,
  LOOP_PRODUCT_FIELDS,
  type LoopRow,
  type LoopSpec,
  type LoopValues,
  loopKey,
  loopLimit,
  parseLoopSource,
} from './loops'

/** A product card as the storefront's own catalogue loader returns it (visibility and order are its job). */
export type LoopProduct = {
  handle: string
  title: string
  vendor: string | null
  productType: string | null
  /** Null when no variant has a price yet (#913). */
  pricePaise: number | null
  mrpPaise: number | null
  images: { url: string; alt: string | null }[]
}

export type LoopLoaders = {
  /** A collection's visible products in its own order, at most `limit`; empty when it has none. */
  collectionProducts?: ((handle: string, limit: number) => Promise<LoopProduct[]>) | undefined
}

function productRow(p: LoopProduct): LoopRow {
  const image = p.images[0]
  const values: Record<keyof typeof LOOP_PRODUCT_FIELDS, unknown> = {
    title: p.title,
    price: p.pricePaise,
    compare_at_price:
      p.pricePaise != null && p.mrpPaise && p.mrpPaise > p.pricePaise ? p.mrpPaise : null,
    vendor: p.vendor,
    type: p.productType,
    featured_image: image ? { url: image.url, alt: image.alt ?? p.title } : null,
    url: `/products/${p.handle}`,
  }
  const row: LoopRow = {}
  for (const [key, type] of Object.entries(LOOP_PRODUCT_FIELDS)) {
    row[key] = { type, value: values[key as keyof typeof LOOP_PRODUCT_FIELDS] }
  }
  return row
}

/** Rows for every metaobject loop: one definition query, then each type's entries once. */
async function metaobjectRows(
  tx: StoreTx,
  wanted: { key: string; type: string; limit: number }[],
  out: LoopValues,
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
  for (const def of defs) {
    const loops = wanted.filter((w) => w.type === def.type)
    const most = Math.max(...loops.map((w) => w.limit))
    const entries = await metaobjectsByType({ tx }, def.type, { limit: most })
    const rows = entries.map((entry) => {
      const row: LoopRow = { handle: { type: 'single_line_text', value: entry.handle } }
      for (const f of def.fields) {
        row[f.key] = { type: f.type as FieldType, value: entry.fields[f.key] }
      }
      return row
    })
    for (const w of loops) out[w.key] = rows.slice(0, w.limit)
  }
}

/**
 * The rows of the given loops for one request, keyed by `loopKey`. A list that cannot be read
 * (a hidden or deleted content type, an unknown collection, no product loader) is simply
 * absent, and its loop renders its typed-in rows.
 */
export async function loadLoopValues(
  tx: StoreTx,
  loops: readonly LoopSpec[],
  loaders: LoopLoaders = {},
): Promise<LoopValues> {
  const out: LoopValues = {}
  const objects: { key: string; type: string; limit: number }[] = []
  const collections: { key: string; handle: string; limit: number }[] = []
  for (const spec of loops) {
    const parsed = parseLoopSource(spec.source)
    if (!parsed) continue
    const entry = { key: loopKey(spec), limit: loopLimit(spec) }
    if (parsed.scope === 'metaobject') objects.push({ ...entry, type: parsed.type })
    else collections.push({ ...entry, handle: parsed.handle })
  }
  if (objects.length) await metaobjectRows(tx, objects, out)
  const load = loaders.collectionProducts
  if (load && collections.length) {
    const handles = [...new Set(collections.map((c) => c.handle))]
    await Promise.all(
      handles.map(async (handle) => {
        const wanted = collections.filter((c) => c.handle === handle)
        const most = Math.max(...wanted.map((c) => c.limit))
        const rows = (await load(handle, most)).map(productRow)
        for (const c of wanted) out[c.key] = rows.slice(0, c.limit)
      }),
    )
  }
  return out
}

/**
 * A collection's active products in its own order, for the Customize preview of a loop (the
 * storefront passes its own catalogue loader instead). Three queries whatever the limit.
 */
export async function previewCollectionProducts(
  tx: StoreTx,
  handle: string,
  limit: number,
): Promise<LoopProduct[]> {
  const [found] = await tx
    .select({ id: collection.id })
    .from(collection)
    .where(eq(collection.handle, handle))
  if (!found) return []
  const rows = await tx
    .select({
      id: product.id,
      handle: product.handle,
      title: product.title,
      vendor: product.vendor,
      productType: product.productType,
    })
    .from(collectionProduct)
    .innerJoin(product, eq(product.id, collectionProduct.productId))
    .where(and(eq(collectionProduct.collectionId, found.id), eq(product.status, 'active')))
    .orderBy(asc(collectionProduct.position))
    .limit(Math.min(limit, LOOP_MAX))
  if (!rows.length) return []
  const ids = rows.map((r) => r.id)
  const [prices, images] = await Promise.all([
    tx
      .select({
        productId: variant.productId,
        price: min(variant.pricePaise),
        mrp: min(variant.mrpPaise),
      })
      .from(variant)
      .where(and(inArray(variant.productId, ids), isNull(variant.archivedAt)))
      .groupBy(variant.productId),
    tx
      .select({
        productId: productMedia.productId,
        url: media.url,
        alt: media.alt,
        position: productMedia.position,
      })
      .from(productMedia)
      .innerJoin(media, eq(media.id, productMedia.mediaId))
      .where(inArray(productMedia.productId, ids))
      .orderBy(asc(productMedia.position)),
  ])
  return rows.map((r) => {
    const price = prices.find((p) => p.productId === r.id)
    const image = images.find((i) => i.productId === r.id)
    return {
      handle: r.handle,
      title: r.title,
      vendor: r.vendor,
      productType: r.productType,
      pricePaise: price?.price ?? null,
      mrpPaise: price?.mrp ?? null,
      images: image ? [{ url: image.url, alt: image.alt }] : [],
    }
  })
}

/** What a loop can read, for the editor's "Use content from…": content types and collections. */
export async function loadLoopCatalog(tx: StoreTx) {
  const [types, collections] = await Promise.all([
    tx
      .select({
        type: metaobjectDefinition.type,
        name: metaobjectDefinition.name,
        fields: metaobjectDefinition.fields,
      })
      .from(metaobjectDefinition)
      .where(eq(metaobjectDefinition.storefrontAccess, true))
      .orderBy(asc(metaobjectDefinition.name)),
    tx
      .select({ handle: collection.handle, title: collection.title })
      .from(collection)
      .orderBy(asc(collection.title)),
  ])
  return {
    types: types.map((t) => ({
      type: t.type,
      name: t.name,
      fields: t.fields.map((f) => ({ key: f.key, name: f.name, type: f.type as FieldType })),
    })),
    collections,
  }
}
