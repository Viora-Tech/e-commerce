/** SOURCE OF TRUTH: markShipmentLost, recordLostScan, reshipLostShipment, updateShipmentClaim — WHAT: a parcel the courier lost: mark it (by hand or from the courier's scan), send it again (the order goes back to To ship and the new box's stock leaves the shelf), and keep the courier claim / WHY: the owner's lost-parcel case (18 Nov 2026): a lost parcel used to sit in In transit forever */
import {
  fulfillmentOrder,
  fulfillmentOrderLine,
  orderLine,
  orderNote,
  shipment,
} from '@commerce/db'
import { and, eq, gt } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { adjustStock } from '../inventory/levels'
import { recomputeOrderStatuses } from '../order/recompute'
import { sharedOrdersOf } from './shared-parcel'
import { type ClaimStatus, claimEstimatePaise, MOVING_STATUSES } from './shipment-lost-state'
import type { ShipmentRow } from './shipments'

/** A lost-parcel step the shipment's state does not allow; the message says why. */
export class ShipmentLostRefused extends CommerceError {
  constructor(message: string, storeId?: string) {
    super('SHIPMENT_LOST_REFUSED', message, { storeId })
  }
}

async function loadShipment(ctx: StoreContext, shipmentId: string): Promise<ShipmentRow> {
  const [row] = await ctx.tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!row) throw new Error('shipment not found')
  return row
}

async function note(ctx: StoreContext, orderId: string, body: string, author: string | null) {
  await ctx.tx.insert(orderNote).values({ storeId: ctx.storeId, orderId, body, author })
}

/** The lost fields every way into `lost` sets: when, and an open claim with its expected amount. */
function lostFields(row: ShipmentRow) {
  return {
    status: 'lost' as const,
    lostAt: row.lostAt ?? new Date(),
    claimStatus: row.claimStatus ?? ('not_filed' as const),
    claimAmountPaise:
      row.claimAmountPaise ?? claimEstimatePaise(row.provider, row.declaredValuePaise, row.insured),
    updatedAt: new Date(),
  }
}

/**
 * "Mark as lost": the courier said so (phone, email, its panel) but its feed did not. Only for a
 * parcel the courier has. The order waits on it (still Shipped) until it is sent again.
 */
export async function markShipmentLost(
  ctx: StoreContext,
  shipmentId: string,
  options: { author?: string | null | undefined } = {},
): Promise<ShipmentRow> {
  const row = await loadShipment(ctx, shipmentId)
  if (!MOVING_STATUSES.has(row.status)) {
    throw new ShipmentLostRefused(
      row.status === 'lost'
        ? 'This parcel is already marked lost.'
        : 'Only a parcel the courier has collected can be marked lost.',
      ctx.storeId,
    )
  }
  const [updated] = await ctx.tx
    .update(shipment)
    .set(lostFields(row))
    .where(eq(shipment.id, shipmentId))
    .returning()
  await note(
    ctx,
    row.orderId,
    `Marked AWB ${row.waybill} as lost. Reship it from Shipments › Lost, and track the courier claim there.`,
    options.author ?? null,
  )
  return updated ?? row
}

/**
 * The courier's own scan said lost (`applyTracking`): the same fields as marking it by hand, so
 * the claim opens either way. Returns the fields to merge into the tracking update.
 */
export function lostScanFields(before: ShipmentRow) {
  return lostFields(before)
}

/** One stock move a resend takes: what the lost box held, from where. */
type ResendUnit = { variantId: string; quantity: number; locationId: string | null }

/** What the lost box held for this order: its parcel's packed units, else the order's. */
async function unitsInBox(
  ctx: StoreContext,
  orderId: string,
  fulfillmentOrderId: string | null,
): Promise<ResendUnit[]> {
  if (fulfillmentOrderId) {
    return ctx.tx
      .select({
        variantId: orderLine.variantId,
        quantity: fulfillmentOrderLine.fulfilledQuantity,
        locationId: fulfillmentOrder.locationId,
      })
      .from(fulfillmentOrderLine)
      .innerJoin(orderLine, eq(orderLine.id, fulfillmentOrderLine.orderLineId))
      .innerJoin(fulfillmentOrder, eq(fulfillmentOrder.id, fulfillmentOrderLine.fulfillmentOrderId))
      .where(
        and(
          eq(fulfillmentOrderLine.fulfillmentOrderId, fulfillmentOrderId),
          gt(fulfillmentOrderLine.fulfilledQuantity, 0),
          eq(orderLine.giftCard, false),
          eq(orderLine.requiresShipping, true),
        ),
      )
  }
  const lines = await ctx.tx
    .select({ variantId: orderLine.variantId, quantity: orderLine.fulfilledQuantity })
    .from(orderLine)
    .where(
      and(
        eq(orderLine.orderId, orderId),
        gt(orderLine.fulfilledQuantity, 0),
        eq(orderLine.giftCard, false),
        eq(orderLine.requiresShipping, true),
      ),
    )
  return lines.map((l) => ({ ...l, locationId: null }))
}

/**
 * "Reship": the same order goes out again, no new sale and no new invoice. The lost label stops
 * counting (like a cancelled one), so the order is back in To ship, still packed, and books a
 * new label with any courier (`rebookableParcels`). The first box is gone, so its items leave
 * the shelf again (on hand drops, logged against the lost AWB). A box shared with other orders
 * ("Same box as #A") is refused: each order is sent again on its own.
 */
export async function reshipLostShipment(
  ctx: StoreContext,
  shipmentId: string,
  options: { author?: string | null | undefined } = {},
): Promise<ShipmentRow> {
  const row = await loadShipment(ctx, shipmentId)
  if (row.status !== 'lost') {
    throw new ShipmentLostRefused('Only a lost parcel can be reshipped.', ctx.storeId)
  }
  if (row.reshippedAt) {
    throw new ShipmentLostRefused('This parcel was already reshipped.', ctx.storeId)
  }
  if ((await sharedOrdersOf(ctx, row.id)).length > 0) {
    throw new ShipmentLostRefused(
      'This box carried other orders too. Duplicate each order to send it again.',
      ctx.storeId,
    )
  }
  const reason = `Reshipped: AWB ${row.waybill} was lost`
  for (const u of await unitsInBox(ctx, row.orderId, row.fulfillmentOrderId)) {
    await adjustStock(ctx.tx, {
      storeId: ctx.storeId,
      variantId: u.variantId,
      locationId: u.locationId ?? undefined,
      delta: -u.quantity,
      reason: 'other',
      note: reason,
    })
  }
  const [updated] = await ctx.tx
    .update(shipment)
    .set({ reshippedAt: new Date(), updatedAt: new Date() })
    .where(eq(shipment.id, shipmentId))
    .returning()
  await note(
    ctx,
    row.orderId,
    `Reshipping lost AWB ${row.waybill}. The order is back in To ship; its items left stock again.`,
    options.author ?? null,
  )
  await recomputeOrderStatuses(ctx, row.orderId)
  return updated ?? row
}

export type ClaimUpdate = {
  status: ClaimStatus
  /** What the claim asks for, or what the courier paid. */
  amountPaise?: number | null | undefined
  /** The courier's claim or ticket number, any note. */
  note?: string | null | undefined
}

/** The courier claim on a lost parcel: filed, paid (with what it paid) or rejected. */
export async function updateShipmentClaim(
  ctx: StoreContext,
  shipmentId: string,
  input: ClaimUpdate,
  options: { author?: string | null | undefined } = {},
): Promise<ShipmentRow> {
  const row = await loadShipment(ctx, shipmentId)
  if (row.status !== 'lost') {
    throw new ShipmentLostRefused('A claim is kept only on a lost parcel.', ctx.storeId)
  }
  const [updated] = await ctx.tx
    .update(shipment)
    .set({
      claimStatus: input.status,
      ...(input.amountPaise !== undefined ? { claimAmountPaise: input.amountPaise } : {}),
      ...(input.note !== undefined ? { claimNote: input.note?.trim() || null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(shipment.id, shipmentId))
    .returning()
  if (input.status !== row.claimStatus) {
    const words: Record<ClaimStatus, string> = {
      not_filed: 'not filed',
      filed: 'filed',
      paid: 'paid',
      rejected: 'rejected',
    }
    await note(
      ctx,
      row.orderId,
      `Courier claim for lost AWB ${row.waybill}: ${words[input.status]}.`,
      options.author ?? null,
    )
  }
  return updated ?? row
}
