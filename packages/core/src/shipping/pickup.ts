import { shipment, shipmentManifest, shipmentPickup } from '@commerce/db'
import type { ShippingProvider } from '@commerce/shipping'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { StoreContext } from '../context'

export type ShipmentPickupRow = typeof shipmentPickup.$inferSelect
export type ShipmentManifestRow = typeof shipmentManifest.$inferSelect

export class PickupNotSupported extends Error {
  constructor(provider: string) {
    super(`${provider} does not support scheduling a pickup through this app.`)
  }
}

/**
 * Book a pickup with the courier for a batch of shipments and mark them as
 * belonging to it. A courier without `schedulePickup` (declared by
 * `capabilities`) is asked to arrange collection outside the app; the row is
 * still recorded so the merchant has one place that lists what is waiting.
 */
export async function schedulePickup(
  ctx: StoreContext,
  provider: ShippingProvider,
  input: {
    shipmentIds: string[]
    date: string
    timeFrom: string
    timeTo?: string | undefined
    pickupLocationName: string
  },
): Promise<ShipmentPickupRow> {
  if (input.shipmentIds.length === 0) throw new Error('pick at least one shipment')

  let providerPickupId: string | null = null
  let status: ShipmentPickupRow['status'] = 'requested'
  let error: string | null = null
  if (provider.schedulePickup) {
    try {
      const r = await provider.schedulePickup({
        pickupLocationName: input.pickupLocationName,
        date: input.date,
        timeFrom: input.timeFrom,
        timeTo: input.timeTo,
        expectedPackageCount: input.shipmentIds.length,
      })
      providerPickupId = r.providerPickupId
      status = 'scheduled'
    } catch (err) {
      status = 'failed'
      error = err instanceof Error ? err.message : String(err)
    }
  }

  const [row] = await ctx.tx
    .insert(shipmentPickup)
    .values({
      storeId: ctx.storeId,
      provider: provider.id,
      scheduledFor: input.date,
      timeFrom: input.timeFrom,
      timeTo: input.timeTo ?? null,
      expectedPackageCount: input.shipmentIds.length,
      status,
      providerRef: providerPickupId,
      error,
    })
    .returning()
  if (!row) throw new Error('could not record the pickup')

  if (status !== 'failed') {
    await ctx.tx
      .update(shipment)
      .set({ pickupId: row.id, updatedAt: new Date() })
      .where(
        and(
          inArray(shipment.id, input.shipmentIds),
          eq(shipment.storeId, ctx.storeId),
          isNull(shipment.pickupId),
        ),
      )
  }
  return row
}

/**
 * Group a pickup's shipments (or an explicit list) into one printable
 * manifest. This is our own record, not a courier API call: Delhivery has no
 * confirmed public "create manifest" endpoint (see packages/shipping-delhivery),
 * so a manifest here is the label set the merchant hands to the pickup
 * executive, generated from the labels already on file.
 */
export async function createManifest(
  ctx: StoreContext,
  provider: ShippingProvider,
  input: { pickupId?: string | undefined; shipmentIds?: string[] | undefined },
): Promise<ShipmentManifestRow> {
  let ids = input.shipmentIds ?? []
  if (input.pickupId) {
    const rows = await ctx.tx
      .select({ id: shipment.id })
      .from(shipment)
      .where(and(eq(shipment.pickupId, input.pickupId), eq(shipment.storeId, ctx.storeId)))
    ids = rows.map((r) => r.id)
  }
  if (ids.length === 0) throw new Error('no shipments to manifest')

  const [row] = await ctx.tx
    .insert(shipmentManifest)
    .values({
      storeId: ctx.storeId,
      provider: provider.id,
      pickupId: input.pickupId ?? null,
      shipmentIds: ids,
    })
    .returning()
  if (!row) throw new Error('could not record the manifest')
  return row
}

export async function listPickups(ctx: StoreContext): Promise<ShipmentPickupRow[]> {
  return ctx.tx
    .select()
    .from(shipmentPickup)
    .where(eq(shipmentPickup.storeId, ctx.storeId))
    .orderBy(shipmentPickup.scheduledFor)
}

/** Shipments not yet attached to a pickup, for the "schedule pickup" picker. */
export async function listUnpickedShipments(ctx: StoreContext) {
  return ctx.tx
    .select()
    .from(shipment)
    .where(
      and(
        eq(shipment.storeId, ctx.storeId),
        isNull(shipment.pickupId),
        eq(shipment.status, 'created'),
      ),
    )
}
