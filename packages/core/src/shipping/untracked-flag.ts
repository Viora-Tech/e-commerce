/**
 * WHAT:  tells the merchant when the courier has no record of a shipment still "Label created"
 *        well after booking: one note on the order, written once.
 * WHY:   order #2503 (27 Nov 2026): Delhivery refused the booking ("Fail", PIN under embargo),
 *        we saved the shipment anyway, and it sat as "Label created" on a waybill Delhivery never
 *        used. The poll kept asking about it and nobody was told. Staff only; the shopper hears
 *        nothing.
 * WHERE: the shipping tracker (apps/worker/src/shipping.ts), after a batched tracking call.
 */
import { orderNote } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'

/** How long after booking a courier may still have no record of a parcel before we say so. */
export const UNTRACKED_GRACE_MS = 30 * 60_000

/** A shipment the courier has no record of, worth flagging: still `created` and older than the grace. */
export function untrackedCreatedShipment(
  row: { status: string; createdAt: Date },
  now: Date,
): boolean {
  return row.status === 'created' && now.getTime() - row.createdAt.getTime() >= UNTRACKED_GRACE_MS
}

/** The note's words. Fixed per courier and waybill, so the same note is never written twice. */
export const untrackedNoteBody = (courier: string, waybill: string): string =>
  `${courier} has no record of waybill ${waybill}, though it was booked over 30 minutes ago and still reads Label created. The booking may not have gone through: check it in ${courier}'s panel, then cancel this shipment here and book again.`

/**
 * Write the note on the order unless it is already there. Returns true when it wrote one.
 */
export async function flagUntrackedShipment(
  ctx: StoreContext,
  row: { orderId: string; waybill: string },
  courier: string,
): Promise<boolean> {
  const body = untrackedNoteBody(courier, row.waybill)
  const [existing] = await ctx.tx
    .select({ id: orderNote.id })
    .from(orderNote)
    .where(and(eq(orderNote.orderId, row.orderId), eq(orderNote.body, body)))
    .limit(1)
  if (existing) return false
  await ctx.tx
    .insert(orderNote)
    .values({ storeId: ctx.storeId, orderId: row.orderId, body, author: null })
  return true
}
