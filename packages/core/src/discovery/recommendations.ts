/** SOURCE OF TRUTH: picked recommendations — WHAT: the merchant's related and complementary picks per product (read for the product page and the Liquid drops, saved by the Search & discovery app) / WHY: one home for the product_recommendation rows, split out of discovery/service.ts */
import { product, productRecommendation, type StoreTx } from '@commerce/db'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { MAX_PICKED_RECOMMENDATIONS, type RecommendationIntentKind } from './query'
import type { PinnedProduct } from './service'

type Row = Record<string, unknown>
const num = (v: unknown): number => Number(v ?? 0)

export type PickedRecommendations = Record<RecommendationIntentKind, PinnedProduct[]>

/** A product's picked recommendations for both rows, in order. */
export async function getProductRecommendations(
  tx: StoreTx,
  productId: string,
): Promise<PickedRecommendations> {
  const rows = await tx
    .select({
      intent: productRecommendation.intent,
      id: product.id,
      title: product.title,
      handle: product.handle,
      status: product.status,
    })
    .from(productRecommendation)
    .innerJoin(product, eq(product.id, productRecommendation.recommendedId))
    .where(eq(productRecommendation.productId, productId))
    .orderBy(asc(productRecommendation.position))
  const out: PickedRecommendations = { related: [], complementary: [] }
  for (const r of rows) {
    const intent = r.intent as RecommendationIntentKind
    out[intent].push({ id: r.id, title: r.title, handle: r.handle, status: r.status })
  }
  return out
}

/** The product a Recommendations editor opens on; null when it is not in the store. */
export async function recommendationTarget(
  tx: StoreTx,
  productId: string,
): Promise<PinnedProduct | null> {
  const [row] = await tx
    .select({
      id: product.id,
      title: product.title,
      handle: product.handle,
      status: product.status,
    })
    .from(product)
    .where(eq(product.id, productId))
  return row ?? null
}

/** Replaces one row's picks for a product. The product itself and unknown ids are dropped. */
export async function setProductRecommendations(
  tx: StoreTx,
  storeId: string,
  productId: string,
  intent: RecommendationIntentKind,
  ids: string[],
): Promise<PickedRecommendations> {
  const wanted = [...new Set(ids)].filter((id) => id !== productId)
  const known = wanted.length
    ? new Set(
        (await tx.select({ id: product.id }).from(product).where(inArray(product.id, wanted))).map(
          (r) => r.id,
        ),
      )
    : new Set<string>()
  const picks = wanted.filter((id) => known.has(id)).slice(0, MAX_PICKED_RECOMMENDATIONS)
  await tx
    .delete(productRecommendation)
    .where(
      and(eq(productRecommendation.productId, productId), eq(productRecommendation.intent, intent)),
    )
  if (picks.length) {
    await tx.insert(productRecommendation).values(
      picks.map((recommendedId, position) => ({
        storeId,
        productId,
        recommendedId,
        intent,
        position,
      })),
    )
  }
  return getProductRecommendations(tx, productId)
}

/** The active products a merchant picked for one row of a product, in their order. */
export async function pickedRecommendationIdsFor(
  tx: StoreTx,
  productId: string,
  intent: RecommendationIntentKind,
): Promise<string[]> {
  const rows = await tx
    .select({ id: productRecommendation.recommendedId })
    .from(productRecommendation)
    .innerJoin(product, eq(product.id, productRecommendation.recommendedId))
    .where(
      and(
        eq(productRecommendation.productId, productId),
        eq(productRecommendation.intent, intent),
        eq(product.status, 'active'),
      ),
    )
    .orderBy(asc(productRecommendation.position))
  return rows.map((r) => r.id)
}

/** Products with picks, newest change first, for the Recommendations page's list. */
export async function productsWithPicks(
  tx: StoreTx,
): Promise<(PinnedProduct & { related: number; complementary: number })[]> {
  const rows = await tx.execute<Row>(sql`
    select p.id, p.title, p.handle, p.status,
      count(*) filter (where r.intent = 'related') as related,
      count(*) filter (where r.intent = 'complementary') as complementary
    from product_recommendation r join product p on p.id = r.product_id
    group by p.id, p.title, p.handle, p.status
    order by p.title
    limit 500`)
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    handle: String(r.handle),
    status: String(r.status),
    related: num(r.related),
    complementary: num(r.complementary),
  }))
}

/** The handles of a product's picked active products for one row, in their order. */
export async function pickedRecommendationHandlesFor(
  tx: StoreTx,
  productId: string,
  intent: RecommendationIntentKind,
): Promise<string[]> {
  const ids = await pickedRecommendationIdsFor(tx, productId, intent)
  if (ids.length === 0) return []
  const rows = await tx
    .select({ id: product.id, handle: product.handle })
    .from(product)
    .where(inArray(product.id, ids))
  const byId = new Map(rows.map((r) => [r.id, r.handle]))
  return ids.flatMap((id) => {
    const handle = byId.get(id)
    return handle ? [handle] : []
  })
}
