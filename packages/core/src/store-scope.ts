/** SOURCE OF TRUTH: ids from the admin checked under the store — WHAT: confirm a customer or media id belongs to the caller's store before it is written as a foreign key / WHY: Postgres checks foreign keys without RLS, so another store's id would be accepted, then block that store from deleting its own row */
import type { StoreTx } from '@commerce/db'
import { customer, media } from '@commerce/db'
import { eq, inArray } from 'drizzle-orm'
import { CommerceError } from './errors'

/** Whether the customer is visible in this store (RLS hides every other store's). */
export async function customerInStore(tx: StoreTx, customerId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: customer.id })
    .from(customer)
    .where(eq(customer.id, customerId))
  return !!row
}

/** Throws NOT_FOUND unless the customer is this store's. No customer is fine. */
export async function assertCustomerInStore(
  tx: StoreTx,
  customerId: string | null | undefined,
  storeId: string,
): Promise<void> {
  if (customerId && !(await customerInStore(tx, customerId))) {
    throw new CommerceError('NOT_FOUND', `Customer ${customerId} not found`, { storeId })
  }
}

/** The given media ids that exist in this store; the rest are another store's or gone. */
export async function mediaInStore(tx: StoreTx, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const rows = await tx.select({ id: media.id }).from(media).where(inArray(media.id, ids))
  return new Set(rows.map((r) => r.id))
}

/**
 * Drops variant images that are not this store's (a stale or foreign id), keeping the rest.
 * With an ordered `mediaIds` list, the main image becomes its first known id.
 */
export function withKnownMedia<
  V extends { mediaId?: string | null | undefined; mediaIds?: string[] | undefined },
>(variants: V[], known: Set<string>): V[] {
  return variants.map((v) => {
    if (v.mediaIds !== undefined) {
      const mediaIds = [...new Set(v.mediaIds.filter((id) => known.has(id)))]
      return { ...v, mediaIds, mediaId: mediaIds[0] ?? null }
    }
    return v.mediaId && !known.has(v.mediaId) ? { ...v, mediaId: null } : v
  })
}

/** Every variant image id a product write names, for one `mediaInStore` check. */
export function variantMediaIds(
  variants: { mediaId?: string | null | undefined; mediaIds?: string[] | undefined }[],
): string[] {
  return variants.flatMap((v) => [...(v.mediaId ? [v.mediaId] : []), ...(v.mediaIds ?? [])])
}
