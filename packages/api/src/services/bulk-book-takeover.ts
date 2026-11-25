import { type BulkCreateResult, takeOverImportedOrder } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { order } from '@commerce/db'
import { and, inArray, isNotNull } from 'drizzle-orm'

/** The single-order path's refusal (`assertNotImported`), for an imported order that cannot be
 *  taken over (already shipped or cancelled on the old platform). */
const READ_ONLY = 'This order was imported and is read-only. Notes and tags can still be changed.'

/**
 * Bulk Create shipment on imported orders still open (a migration's live orders). Booking one as
 * it is left it imported: its statuses keep following the import (`recomputeOrderStatuses` reads
 * `import_meta` for them), so the order stayed Unfulfilled and read-only with a booked label, and
 * the merchant had to open each one and click "Manage this order" (owner, 25 Nov 2026). The
 * single-order path refuses until the order is taken over; bulk takes each one over first, as
 * the cancel does (`cancelOrderByStaff`), so after booking it is fulfilled, timelined and
 * announced exactly like an order booked from its own page. Returns the orders that could not
 * be taken over, with the single-order path's reason, so the caller skips them.
 */
export async function takeOverImportedForBooking(
  tx: StoreTx,
  storeId: string,
  orderIds: readonly string[],
  author: string,
): Promise<BulkCreateResult[]> {
  if (orderIds.length === 0) return []
  const imported = await tx
    .select({ id: order.id })
    .from(order)
    .where(and(inArray(order.id, [...orderIds]), isNotNull(order.importedFrom)))
  const refused: BulkCreateResult[] = []
  for (const { id } of imported) {
    try {
      await takeOverImportedOrder({ tx, storeId }, id, author)
    } catch {
      refused.push({ orderId: id, ok: false, error: READ_ONLY })
    }
  }
  return refused
}
