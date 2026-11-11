import {
  applyNdrAction,
  createManifest,
  getWalletBalance,
  listUnpickedShipments,
  recordWalletBalance,
  refreshWalletBalance,
  resolveShippingProviders,
  type ShippingRegistry,
  schedulePickup,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  fulfillmentOrder,
  location,
  order,
  shipment,
  shipmentManifest,
  shipmentPickup,
  store,
} from '@commerce/db'
import type { NdrAction } from '@commerce/shipping'
import { ORPCError } from '@orpc/server'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { courierToRpc, requireProvider, requireProviderById } from './shipments-provider.service'
import { loadShippingSettings } from './shipping.service'

/**
 * Ask each courier to collect its own parcels: the shipments are grouped by the courier that
 * holds them and by the pickup location they leave from (the parcel's location name on the
 * courier the booking used), one pickup request per group (joined when one is already scheduled
 * for that place and day, see `schedulePickup`). Parcels shipped
 * by hand (a courier that is not connected) are left out.
 */
export async function schedulePickupForStore(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  input: {
    shipmentIds: string[]
    date: string
    timeFrom: string
    timeTo?: string | undefined
    /** "Add to pickup": the booked pickup the merchant picked (`schedulePickup`). */
    joinPickupId?: string | undefined
  },
) {
  const settings = await loadShippingSettings(tx, storeId)
  const { providers } = resolveShippingProviders(registry, settings, secret)
  const rows = await tx
    .select({
      id: shipment.id,
      provider: shipment.provider,
      pickup: location.courierPickup,
      booked: shipment.pickupLocationName,
    })
    .from(shipment)
    .leftJoin(fulfillmentOrder, eq(fulfillmentOrder.id, shipment.fulfillmentOrderId))
    .leftJoin(location, eq(location.id, fulfillmentOrder.locationId))
    .where(inArray(shipment.id, input.shipmentIds))
  const fallbackName = settings.policy.warehouse.name || 'Warehouse'
  const groups = new Map<string, { providerId: string; place: string; ids: string[] }>()
  for (const row of rows) {
    const provider = providers.find((p) => p.id === row.provider)
    if (!provider) continue
    /* The place the booking told the courier (kept on the shipment), else the parcel's location
       name on the courier, else the courier account's own, else Settings › Shipping's: a pickup
       for any other name never collects these waybills (they stay "Ready to Ship"). */
    const place =
      row.booked || row.pickup?.pickupName || provider.defaultPickupLocationName || fallbackName
    const key = `${row.provider}|${place}`
    const group = groups.get(key) ?? { providerId: row.provider, place, ids: [] }
    group.ids.push(row.id)
    groups.set(key, group)
  }
  if (groups.size === 0) {
    throw new ORPCError('PRECONDITION_FAILED', {
      message: 'None of these parcels is with a connected courier.',
    })
  }
  const pickups = []
  for (const group of groups.values()) {
    const provider = providers.find((p) => p.id === group.providerId)
    if (!provider) continue
    pickups.push(
      await schedulePickup({ storeId, tx }, provider, {
        ...input,
        shipmentIds: group.ids,
        pickupLocationName: group.place,
      }).catch(courierToRpc),
    )
  }
  return pickups
}

export async function createManifestForStore(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  input: { pickupId?: string | undefined; shipmentIds?: string[] | undefined },
) {
  const provider = await requireProvider(tx, storeId, registry, secret)
  return createManifest({ storeId, tx }, provider, input)
}

export async function listUnpickedForStore(tx: StoreTx, storeId: string) {
  return listUnpickedShipments({ storeId, tx })
}

export async function listPickupsForStore(tx: StoreTx, storeId: string) {
  return tx
    .select()
    .from(shipmentPickup)
    .where(eq(shipmentPickup.storeId, storeId))
    .orderBy(desc(shipmentPickup.createdAt))
}

export async function listManifestsForStore(tx: StoreTx, storeId: string) {
  return tx
    .select()
    .from(shipmentManifest)
    .where(eq(shipmentManifest.storeId, storeId))
    .orderBy(desc(shipmentManifest.createdAt))
}

export async function listNdrForStore(tx: StoreTx, storeId: string) {
  return tx
    .select({
      id: shipment.id,
      orderId: shipment.orderId,
      orderNumber: order.number,
      waybill: shipment.waybill,
      provider: shipment.provider,
      ndrReason: shipment.ndrReason,
      ndrRaisedAt: shipment.ndrRaisedAt,
    })
    .from(shipment)
    .innerJoin(order, eq(order.id, shipment.orderId))
    .where(and(eq(shipment.storeId, storeId), eq(shipment.ndrStatus, 'pending')))
    .orderBy(desc(shipment.ndrRaisedAt))
}

export async function actOnNdr(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  input: {
    shipmentId: string
    action: NdrAction
    name?: string | undefined
    phone?: string | undefined
    address?: string | undefined
    comment?: string | undefined
  },
) {
  const [row] = await tx.select().from(shipment).where(eq(shipment.id, input.shipmentId))
  if (!row) throw new ORPCError('NOT_FOUND')
  const provider = await requireProviderById(tx, storeId, registry, secret, row.provider)
  return applyNdrAction({ storeId, tx }, provider, input.shipmentId, input.action, input).catch(
    courierToRpc,
  )
}

/** One wallet card per connected courier, not just the primary - each courier has its own
 *  account and its own balance. */
export async function listWalletCards(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
) {
  const settings = await loadShippingSettings(tx, storeId)
  const { providers } = resolveShippingProviders(registry, settings, secret)
  return Promise.all(
    providers.map(async (provider) => {
      const wallet = await getWalletBalance({ storeId, tx }, provider.id)
      return {
        provider: provider.id,
        providerLabel: provider.label,
        supportsLiveBalance: Boolean(provider.getWalletBalance),
        balancePaise: wallet?.balancePaise ?? 0,
        lowBalanceThresholdPaise:
          wallet?.lowBalanceThresholdPaise ?? settings.policy.lowWalletBalancePaise,
        source: wallet?.source ?? 'manual',
        fetchedAt: wallet?.fetchedAt ?? null,
        low:
          (wallet?.balancePaise ?? 0) <
          (wallet?.lowBalanceThresholdPaise ?? settings.policy.lowWalletBalancePaise),
      }
    }),
  )
}

export async function refreshWallet(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  providerId: string,
  lowBalanceThresholdPaise?: number,
) {
  const provider = await requireProviderById(tx, storeId, registry, secret, providerId)
  return refreshWalletBalance({ storeId, tx }, provider, lowBalanceThresholdPaise)
}

export async function recordWallet(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  providerId: string,
  balancePaise: number,
) {
  const provider = await requireProviderById(tx, storeId, registry, secret, providerId)
  return recordWalletBalance({ storeId, tx }, provider.id, balancePaise)
}

/** Order numbers -> ids, for the "book by order number" panel; unmatched numbers are just left out. */
export async function resolveOrderNumbers(tx: StoreTx, numbers: number[]) {
  if (numbers.length === 0) return []
  return tx
    .select({ id: order.id, number: order.number })
    .from(order)
    .where(inArray(order.number, numbers))
}

/** Store name shown on the pickup/manifest confirmation, without pulling the whole store row. */
export async function storeName(tx: StoreTx, storeId: string): Promise<string> {
  const [s] = await tx.select({ name: store.name }).from(store).where(eq(store.id, storeId))
  return s?.name ?? ''
}
