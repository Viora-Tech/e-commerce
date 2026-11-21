/** SOURCE OF TRUTH: markPrinted — WHAT: remembers the first time staff printed or downloaded an invoice's PDF / WHY: the Invoices list shows "Not printed" until then (owner, 18 Nov 2026) */
import type { StoreTx } from '@commerce/db'
import { and, inArray, isNull } from 'drizzle-orm'
import { invoice } from './schema'

/** Stamps `printed_at` on those not stamped yet; a reprint keeps the first time. */
export async function markPrinted(tx: StoreTx, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return
  await tx
    .update(invoice)
    .set({ printedAt: new Date() })
    .where(and(inArray(invoice.id, [...ids]), isNull(invoice.printedAt)))
}
