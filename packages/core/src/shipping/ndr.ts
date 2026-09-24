import { shipment } from '@commerce/db'
import type { NdrAction, ShippingProvider } from '@commerce/shipping'
import { and, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import type { ShipmentRow } from './shipments'

/** Shipments the courier flagged as an undelivered-delivery-attempt, waiting on the merchant. */
export async function listNdrShipments(ctx: StoreContext): Promise<ShipmentRow[]> {
  return ctx.tx
    .select()
    .from(shipment)
    .where(and(eq(shipment.storeId, ctx.storeId), eq(shipment.ndrStatus, 'pending')))
}

/**
 * Record an NDR call from the courier (webhook or manual "mark as NDR" from
 * the queue when a scan describes it but the webhook has not landed yet).
 */
export async function raiseNdr(
  ctx: StoreContext,
  shipmentId: string,
  reason: string,
): Promise<void> {
  await ctx.tx
    .update(shipment)
    .set({
      ndrStatus: 'pending',
      ndrReason: reason,
      ndrRaisedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(shipment.id, shipmentId), eq(shipment.storeId, ctx.storeId)))
}

/**
 * Tell the courier what to do about an undelivered attempt: try again, use a
 * new address, or send it back. The shipment moves to `action_taken`; the
 * next tracking scan (poll or webhook) resolves it once the courier acts.
 */
export async function applyNdrAction(
  ctx: StoreContext,
  provider: ShippingProvider,
  shipmentId: string,
  action: NdrAction,
  input: {
    name?: string | undefined
    phone?: string | undefined
    address?: string | undefined
    comment?: string | undefined
  } = {},
): Promise<ShipmentRow> {
  if (!provider.ndrAction) {
    throw new Error(`${provider.id} does not support NDR actions through this app.`)
  }
  const [row] = await ctx.tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!row) throw new Error('shipment not found')

  const result = await provider.ndrAction({ waybill: row.waybill, action, ...input })

  const [updated] = await ctx.tx
    .update(shipment)
    .set({
      ndrStatus: result.accepted ? 'action_taken' : 'pending',
      ndrAction: action,
      ndrActionAt: new Date(),
      ndrActionRef: result.providerRef ?? null,
      updatedAt: new Date(),
    })
    .where(eq(shipment.id, shipmentId))
    .returning()
  return updated ?? row
}
