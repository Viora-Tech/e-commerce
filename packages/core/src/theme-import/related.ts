/** SOURCE OF TRUTH: related products for imported themes — WHAT: the products Shopify's `/recommendations/products` and the `recommendations` Liquid object show next to a product: first the ones sharing a collection with it, then the ones sharing its product type, vendor or tags, then the store's best sellers; never the product itself, only published (active) products / WHY: a theme's "You may also like" row calls Shopify's recommendations endpoint; we answer from our own catalogue, store-scoped by RLS */
import { collectionProduct, product, type StoreTx } from '@commerce/db'
import { and, eq, inArray, ne, notInArray, or, sql } from 'drizzle-orm'
import { keyFromName } from '../metaobjects/validate'
import type { LiquidMetafieldData, RecommendationIntent } from './drops'

/**
 * Where Shopify's Search & Discovery app keeps a product's hand-picked recommendations
 * (`shopify--discovery--product_recommendation`), as the importer stored the namespace.
 */
export const DISCOVERY_NAMESPACE = keyFromName('shopify--discovery--product_recommendation')

const DISCOVERY_KEY: Record<RecommendationIntent, string> = {
  related: 'related_products',
  complementary: 'complementary_products',
}

/** The products a merchant picked for one intent, in their order, from the product's extra fields. */
export function pickedRecommendationIds(
  fields: LiquidMetafieldData[],
  intent: RecommendationIntent,
): string[] {
  const field = fields.find(
    (f) => f.namespace === DISCOVERY_NAMESPACE && f.key === DISCOVERY_KEY[intent],
  )
  const values = Array.isArray(field?.value) ? field.value : field?.value ? [field.value] : []
  const ids = values.flatMap((v) => {
    const ref = v as { kind?: unknown; id?: unknown }
    return ref?.kind === 'product' && typeof ref.id === 'string' ? [ref.id] : []
  })
  return [...new Set(ids)]
}

/** Shopify allows 1 to 10 recommendations per request. */
export const MAX_RECOMMENDATIONS = 10

export type RelatedCandidate = {
  id: string
  type: string
  /** The brand; optional so callers that never had one still rank. */
  vendor?: string
  tags: string[]
  /** Collections it shares with the product. */
  sharedCollections: number
}

/**
 * Orders candidates: sharing collections beats sharing type, vendor or tags; within a group,
 * the more shared collections, then a matching type and vendor, then the more shared tags, first.
 * Ties keep their input order (the caller sorts newest first), so the result is stable.
 */
export function rankRelated(
  base: { type: string; vendor?: string; tags: string[] },
  candidates: RelatedCandidate[],
): string[] {
  const tags = new Set(base.tags.map((t) => t.toLowerCase()))
  const same = (a: string | undefined, b: string | undefined) =>
    a !== undefined && a !== '' && a.toLowerCase() === (b ?? '').toLowerCase() ? 1 : 0
  const scored = candidates.map((c, index) => ({
    id: c.id,
    index,
    collections: c.sharedCollections,
    type: same(base.type, c.type) + same(base.vendor, c.vendor),
    tags: c.tags.filter((t) => tags.has(t.toLowerCase())).length,
  }))
  return scored
    .filter((s) => s.collections > 0 || s.type > 0 || s.tags > 0)
    .sort(
      (a, b) =>
        Number(b.collections > 0) - Number(a.collections > 0) ||
        b.collections - a.collections ||
        b.type - a.type ||
        b.tags - a.tags ||
        a.index - b.index,
    )
    .map((s) => s.id)
}

/** How many candidates to read before the caller drops sold-out ones. */
const POOL = 120

/**
 * The first `wanted` in-stock products of a ranked id list, in rank order. Loads the list a
 * chunk at a time (three times `wanted`) and stops once it has enough, so a run of sold-out
 * close matches never empties the row while an in-stock match sits further down.
 */
export async function firstAvailable<T extends { variants: { available: boolean }[] }>(
  ids: string[],
  wanted: number,
  load: (chunk: string[]) => Promise<T[]>,
): Promise<T[]> {
  const chunk = Math.max(1, wanted * 3)
  const found: T[] = []
  for (let at = 0; at < ids.length && found.length < wanted; at += chunk) {
    const loaded = await load(ids.slice(at, at + chunk))
    found.push(...loaded.filter((p) => p.variants.some((v) => v.available)))
  }
  return found.slice(0, wanted)
}

/**
 * The store's published products by units sold (paid, non-test orders), newest first on a
 * tie, leaving out `exclude`: what fills a related row once the close matches run out.
 */
async function bestSellerIds(
  tx: StoreTx,
  exclude: string[],
  limit: number = POOL,
): Promise<string[]> {
  const rows = await tx
    .select({ id: product.id })
    .from(product)
    .where(
      and(
        eq(product.status, 'active'),
        exclude.length > 0 ? notInArray(product.id, exclude) : undefined,
      ),
    )
    .orderBy(
      sql`(
        select coalesce(sum(ol.quantity), 0) from order_line ol
        join variant v on v.id = ol.variant_id
        join "order" o on o.id = ol.order_id
        where v.product_id = ${product.id} and o.status not in ('draft', 'cancelled') and not o.is_test
      ) desc`,
      sql`${product.createdAt} desc`,
      sql`${product.id} desc`,
    )
    .limit(limit)
  return rows.map((r) => r.id)
}

/**
 * Candidate product ids for one product, best first: the close matches (`rankRelated`), then
 * the store's best sellers. Unpublished products and the product itself are never returned;
 * sold-out ones are dropped by the caller once it has loaded them (availability lives on the
 * variants).
 */
export async function relatedProductIds(tx: StoreTx, productId: string): Promise<string[]> {
  const [base] = await tx
    .select({ type: product.productType, vendor: product.vendor, tags: product.tags })
    .from(product)
    .where(eq(product.id, productId))
  if (!base) return []
  const mine = tx
    .select({ id: collectionProduct.collectionId })
    .from(collectionProduct)
    .where(eq(collectionProduct.productId, productId))
  const shared = await tx
    .select({ id: collectionProduct.productId, n: sql<number>`count(*)` })
    .from(collectionProduct)
    .where(
      and(
        inArray(collectionProduct.collectionId, mine),
        ne(collectionProduct.productId, productId),
      ),
    )
    .groupBy(collectionProduct.productId)
  const sharedBy = new Map(shared.map((r) => [r.id, Number(r.n)]))
  const type = base.type ?? ''
  const vendor = base.vendor ?? ''
  const matches = [
    sharedBy.size > 0 ? inArray(product.id, [...sharedBy.keys()]) : undefined,
    type !== '' ? sql`lower(${product.productType}) = ${type.toLowerCase()}` : undefined,
    vendor !== '' ? sql`lower(${product.vendor}) = ${vendor.toLowerCase()}` : undefined,
    base.tags.length > 0 ? sql`${product.tags} && ${sql.param(base.tags)}::text[]` : undefined,
  ].filter((m) => m !== undefined)
  const rows =
    matches.length === 0
      ? []
      : await tx
          .select({
            id: product.id,
            type: product.productType,
            vendor: product.vendor,
            tags: product.tags,
          })
          .from(product)
          .where(and(eq(product.status, 'active'), ne(product.id, productId), or(...matches)))
          .orderBy(sql`${product.createdAt} desc`)
          .limit(POOL)
  const ranked = rankRelated(
    { type, vendor, tags: base.tags },
    rows.map((r) => ({
      id: r.id,
      type: r.type ?? '',
      vendor: r.vendor ?? '',
      tags: r.tags,
      sharedCollections: sharedBy.get(r.id) ?? 0,
    })),
  )
  const sellers = await bestSellerIds(tx, [productId, ...ranked], POOL)
  return [...ranked, ...sellers]
}
