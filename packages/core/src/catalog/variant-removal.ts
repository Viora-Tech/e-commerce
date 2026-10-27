/** SOURCE OF TRUTH: deleting variants in bulk — WHAT: the bulk editor's "Delete variants" (#847) / WHY: a product keeps at least one variant; history keeps archived ones */
import type { StoreTx } from '@commerce/db'
import { product, variant } from '@commerce/db'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { removeVariants } from './products'

/** Variants the bulk editor was asked to delete that would leave their product with none. */
export type VariantRemovalBlocked = { productId: string; title: string }

/**
 * Delete variants picked in the bulk editor (#847), the way the product page drops one: a
 * variant an order, cart or stock document still points at is archived, the rest are deleted.
 * A product keeps at least one variant; when a pick would take its last, nothing is removed and
 * the products are named.
 */
export async function removeVariantsById(
  tx: StoreTx,
  ids: string[],
): Promise<{ ok: true; removed: number } | { ok: false; blocked: VariantRemovalBlocked[] }> {
  const picked = new Set(ids)
  const live = await tx
    .select({ id: variant.id, productId: variant.productId, title: product.title })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(
      and(
        isNull(variant.archivedAt),
        inArray(
          variant.productId,
          tx.select({ id: variant.productId }).from(variant).where(inArray(variant.id, ids)),
        ),
      ),
    )
  const left = new Map<string, { title: string; remaining: number }>()
  for (const v of live) {
    const entry = left.get(v.productId) ?? { title: v.title, remaining: 0 }
    if (!picked.has(v.id)) entry.remaining += 1
    left.set(v.productId, entry)
  }
  const blocked = [...left]
    .filter(([, e]) => e.remaining === 0)
    .map(([productId, e]) => ({ productId, title: e.title }))
  if (blocked.length) return { ok: false, blocked }
  const removable = live.filter((v) => picked.has(v.id)).map((v) => v.id)
  if (removable.length) await removeVariants(tx, removable)
  return { ok: true, removed: removable.length }
}
