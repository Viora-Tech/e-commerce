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
import { dayKey } from '@commerce/dates'
import type { StoreTx } from '@commerce/db'
import {
  address,
  customer,
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
import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import { courierToRpc, requireProvider, requireProviderById } from './shipments-provider.service'
import { loadShippingSettings } from './shipping.service'

/**
 * The courier pickup location a parcel leaves from: the place the booking told the courier (kept
 * on the shipment), else the parcel's location name on the courier, else the courier account's
 * own, else Settings › Shipping's. A pickup for any other name never collects its waybill (it
 * stays "Ready to Ship").
 */
function pickupPlaceName(
  row: { booked: string | null; pickup: { pickupName: string } | null },
  provider: { defaultPickupLocationName?: string | undefined },
  fallbackName: string,
): string {
  return row.booked || row.pickup?.pickupName || provider.defaultPickupLocationName || fallbackName
}

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
    const place = pickupPlaceName(row, provider, fallbackName)
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

/** A booked parcel offered in the Create pickup drawer's "Parcels in this pickup" list. */
type PickupParcel = {
  shipmentId: string
  orderId: string
  orderNumber: number
  waybill: string
  customerName: string | null
  city: string | null
  weightGrams: number | null
  createdAt: Date
  /** One of the parcels the drawer was opened for: ticked to start with. */
  anchor: boolean
}

/**
 * What the Create pickup drawer (Figma 905:8280 / 906:8464) needs for the given booked parcels:
 * one group per courier and pickup location they leave from (as `schedulePickupForStore` groups
 * them), each with the courier's other booked parcels from that place still without a pickup
 * (tickable) and the pickups already booked there from today on (joining one asks the courier
 * nothing new). Parcels of a courier that is not connected are left out.
 */
export async function listPickupOptionsForStore(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  shipmentIds: string[],
) {
  const settings = await loadShippingSettings(tx, storeId)
  const { providers } = resolveShippingProviders(registry, settings, secret)
  const fallbackName = settings.policy.warehouse.name || 'Warehouse'
  const today = dayKey(new Date())

  const anchors = await tx
    .select({ id: shipment.id, provider: shipment.provider })
    .from(shipment)
    .where(and(eq(shipment.storeId, storeId), inArray(shipment.id, shipmentIds)))
  const providerIds = [...new Set(anchors.map((a) => a.provider))].filter((id) =>
    providers.some((p) => p.id === id),
  )
  if (providerIds.length === 0) return { today, groups: [] }
  const anchorIds = new Set(anchors.map((a) => a.id))

  /* The anchors, plus every parcel of the same couriers booked and not yet on a pickup. */
  const rows = await tx
    .select({
      id: shipment.id,
      provider: shipment.provider,
      booked: shipment.pickupLocationName,
      pickup: location.courierPickup,
      waybill: shipment.waybill,
      weightGrams: shipment.weightGrams,
      createdAt: shipment.createdAt,
      orderId: order.id,
      orderNumber: order.number,
      customerName: sql<string | null>`coalesce(${address.name}, ${customer.name})`,
      city: address.city,
    })
    .from(shipment)
    .innerJoin(order, eq(order.id, shipment.orderId))
    .leftJoin(address, eq(address.id, order.shippingAddressId))
    .leftJoin(customer, eq(customer.id, order.customerId))
    .leftJoin(fulfillmentOrder, eq(fulfillmentOrder.id, shipment.fulfillmentOrderId))
    .leftJoin(location, eq(location.id, fulfillmentOrder.locationId))
    .where(
      and(
        eq(shipment.storeId, storeId),
        inArray(shipment.provider, providerIds),
        eq(shipment.status, 'created'),
        isNull(shipment.pickupId),
      ),
    )
    .orderBy(desc(shipment.createdAt))
    .limit(500)

  const groups = new Map<
    string,
    { providerId: string; place: string; hasAnchor: boolean; parcels: PickupParcel[] }
  >()
  for (const row of rows) {
    const provider = providers.find((p) => p.id === row.provider)
    if (!provider) continue
    const place = pickupPlaceName(row, provider, fallbackName)
    const key = `${row.provider}|${place}`
    const group = groups.get(key) ?? {
      providerId: row.provider,
      place,
      hasAnchor: false,
      parcels: [],
    }
    const anchor = anchorIds.has(row.id)
    group.hasAnchor ||= anchor
    group.parcels.push({
      shipmentId: row.id,
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      waybill: row.waybill,
      customerName: row.customerName,
      city: row.city,
      weightGrams: row.weightGrams,
      createdAt: row.createdAt,
      anchor,
    })
    groups.set(key, group)
  }
  const wanted = [...groups.values()].filter((g) => g.hasAnchor)
  if (wanted.length === 0) return { today, groups: [] }

  /* The store's locations by their name on the courier, for the place's city and PIN. */
  const places = await tx
    .select({
      name: location.name,
      pickup: location.courierPickup,
      city: location.city,
      pincode: location.pincode,
    })
    .from(location)
    .where(eq(location.storeId, storeId))

  const open = await tx
    .select({
      id: shipmentPickup.id,
      provider: shipmentPickup.provider,
      place: shipmentPickup.pickupLocationName,
      scheduledFor: shipmentPickup.scheduledFor,
      timeFrom: shipmentPickup.timeFrom,
      timeTo: shipmentPickup.timeTo,
      providerRef: shipmentPickup.providerRef,
      expectedPackageCount: shipmentPickup.expectedPackageCount,
    })
    .from(shipmentPickup)
    .where(
      and(
        eq(shipmentPickup.storeId, storeId),
        inArray(shipmentPickup.provider, providerIds),
        eq(shipmentPickup.status, 'scheduled'),
        gte(shipmentPickup.scheduledFor, today),
      ),
    )
    .orderBy(asc(shipmentPickup.scheduledFor))
  const inPickup =
    open.length === 0
      ? []
      : await tx
          .select({ pickupId: shipment.pickupId, orderNumber: order.number })
          .from(shipment)
          .innerJoin(order, eq(order.id, shipment.orderId))
          .where(
            and(
              eq(shipment.storeId, storeId),
              inArray(
                shipment.pickupId,
                open.map((p) => p.id),
              ),
            ),
          )

  return {
    today,
    groups: wanted.map((g) => {
      const provider = providers.find((p) => p.id === g.providerId)
      const where = places.find((l) => (l.pickup?.pickupName || l.name) === g.place)
      return {
        key: `${g.providerId}|${g.place}`,
        providerId: g.providerId,
        providerLabel: provider?.label ?? g.providerId,
        place: g.place,
        city: where?.city ?? null,
        pincode: where?.pincode ?? null,
        /** The anchors first, then the rest newest first. */
        parcels: g.parcels.toSorted((a, b) => Number(b.anchor) - Number(a.anchor)),
        pickups: open
          .filter(
            (p) =>
              p.provider === g.providerId &&
              (p.place || provider?.defaultPickupLocationName || fallbackName) === g.place,
          )
          .map((p) => ({
            id: p.id,
            scheduledFor: p.scheduledFor,
            timeFrom: p.timeFrom,
            timeTo: p.timeTo,
            providerRef: p.providerRef,
            parcelCount: p.expectedPackageCount,
            orderNumbers: inPickup
              .filter((s) => s.pickupId === p.id)
              .map((s) => s.orderNumber)
              .toSorted((a, b) => a - b),
          })),
      }
    }),
  }
}
