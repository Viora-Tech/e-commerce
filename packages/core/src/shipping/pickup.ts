import { dayKey } from '@commerce/dates'
import { shipment, shipmentManifest, shipmentPickup } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import type { ShippingProvider } from '@commerce/shipping'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'

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
 *
 * One request per courier, pickup location and day: when one is already scheduled, the
 * shipments join it and the courier is not asked again (Delhivery takes a second request for
 * a place only after the first was collected). A failed request is recorded with its error and
 * the shipments stay unattached, so "Request pickup" can try again.
 */
export async function schedulePickup(
  ctx: StoreContext,
  provider: ShippingProvider,
  input: {
    shipmentIds: string[]
    date: string
    timeFrom: string
    timeTo?: string | undefined
    /** The courier pickup location; empty for the courier account's own (`defaultPickupLocationName`). */
    pickupLocationName: string
    /**
     * A pickup already booked that the merchant picked to add these parcels to ("Add to pickup").
     * Used when it is this courier's and still scheduled; otherwise the day and place decide.
     */
    joinPickupId?: string | undefined
  },
): Promise<ShipmentPickupRow> {
  if (input.shipmentIds.length === 0) throw new Error('pick at least one shipment')
  // A new pickup can't be booked for a day that has passed (India time); joining one stays allowed.
  if (!input.joinPickupId && input.date < dayKey(new Date())) {
    throw new CommerceError('BAD_REQUEST', 'Pick today or a later day for the pickup')
  }
  const place = input.pickupLocationName || provider.defaultPickupLocationName || ''

  const [open] = await ctx.tx
    .select()
    .from(shipmentPickup)
    .where(
      and(
        eq(shipmentPickup.storeId, ctx.storeId),
        eq(shipmentPickup.provider, provider.id),
        eq(shipmentPickup.status, 'scheduled'),
        ...(input.joinPickupId
          ? [eq(shipmentPickup.id, input.joinPickupId)]
          : [
              eq(shipmentPickup.scheduledFor, input.date),
              eq(shipmentPickup.pickupLocationName, place),
            ]),
      ),
    )
    .limit(1)
  if (open) {
    const attached = await attachToPickup(ctx, open.id, input.shipmentIds)
    const [joined] = await ctx.tx
      .update(shipmentPickup)
      .set({
        expectedPackageCount: open.expectedPackageCount + attached,
        updatedAt: new Date(),
      })
      .where(eq(shipmentPickup.id, open.id))
      .returning()
    return joined ?? open
  }

  let providerPickupId: string | null = null
  let status: ShipmentPickupRow['status'] = 'requested'
  let error: string | null = null
  if (provider.schedulePickup) {
    try {
      const r = await provider.schedulePickup({
        pickupLocationName: place,
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
      // The one line to look for when a merchant says the pickup "did not go through".
      logger.warn('courier pickup request refused', {
        storeId: ctx.storeId,
        provider: provider.id,
        pickupLocationName: place,
        date: input.date,
        timeFrom: input.timeFrom,
        parcels: input.shipmentIds.length,
        reason: error,
      })
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
      pickupLocationName: place || null,
      status,
      providerRef: providerPickupId,
      error,
    })
    .returning()
  if (!row) throw new Error('could not record the pickup')

  if (status !== 'failed') await attachToPickup(ctx, row.id, input.shipmentIds)
  return row
}

/** Mark the shipments not yet on a pickup as belonging to this one; how many it took. */
async function attachToPickup(
  ctx: StoreContext,
  pickupId: string,
  shipmentIds: string[],
): Promise<number> {
  const rows = await ctx.tx
    .update(shipment)
    .set({ pickupId, updatedAt: new Date() })
    .where(
      and(
        inArray(shipment.id, shipmentIds),
        eq(shipment.storeId, ctx.storeId),
        isNull(shipment.pickupId),
      ),
    )
    .returning({ id: shipment.id })
  return rows.length
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
