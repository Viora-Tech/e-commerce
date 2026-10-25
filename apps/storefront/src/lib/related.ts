import 'server-only'

import type { PolicyPanel } from '@commerce/blocks'
import { POLICY_TYPES, policyPath } from '@commerce/core/policies'
import { collection, collectionProduct, page, product, type StoreTx } from '@commerce/db'
import { and, desc, eq, inArray, isNotNull, ne } from 'drizzle-orm'
import { policyPanelsContent as copy } from '@/data/product'

/** Collections every product sits in, which say nothing about what is related. */
const CATCH_ALL = new Set(['all', 'frontpage', 'home-page'])

/**
 * Handles of products related to this one, best first: others from its own collections (not
 * catch-all ones), newest first. The caller fills up with same-type products when these run short.
 */
export async function relatedHandles(
  tx: StoreTx,
  productId: string,
  limit: number,
): Promise<string[]> {
  const own = await tx
    .select({ id: collection.id, handle: collection.handle })
    .from(collectionProduct)
    .innerJoin(collection, eq(collection.id, collectionProduct.collectionId))
    .where(and(eq(collectionProduct.productId, productId), eq(collection.status, 'active')))
  const ids = own.filter((c) => !CATCH_ALL.has(c.handle)).map((c) => c.id)
  if (ids.length === 0) return []
  const rows = await tx
    .selectDistinct({ handle: product.handle, createdAt: product.createdAt })
    .from(collectionProduct)
    .innerJoin(product, eq(product.id, collectionProduct.productId))
    .where(
      and(
        inArray(collectionProduct.collectionId, ids),
        ne(product.id, productId),
        eq(product.status, 'active'),
      ),
    )
    .orderBy(desc(product.createdAt))
    .limit(limit)
  return rows.map((r) => r.handle)
}

/** The panels below a product's details: Shipping and Returns, only for published policies. */
export async function policyPanels(tx: StoreTx): Promise<PolicyPanel[]> {
  const wanted = POLICY_TYPES.filter((t) => t === 'shipping-policy' || t === 'refund-policy')
  const rows = await tx
    .select({ handle: page.handle })
    .from(page)
    .where(and(inArray(page.handle, [...wanted]), isNotNull(page.publishedAt)))
  const published = new Set(rows.map((r) => r.handle))
  return wanted
    .filter((t) => published.has(t))
    .map((t) => ({
      ...copy[t === 'shipping-policy' ? 'shipping' : 'returns'],
      href: policyPath(t),
    }))
}
