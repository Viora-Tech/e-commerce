import {
  applyNdrAction,
  bulkCreateShipments,
  createManifest,
  getWalletBalance,
  listUnpickedShipments,
  primaryShippingProvider,
  recordWalletBalance,
  refreshWalletBalance,
  type ShippingRegistry,
  schedulePickup,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { order, shipment, shipmentManifest, shipmentPickup, store } from '@commerce/db'
import { CourierError, describeCourierFailure, type NdrAction } from '@commerce/shipping'
import { ORPCError } from '@orpc/server'
import { and, count, desc, eq, ilike, inArray, or } from 'drizzle-orm'
import { loadShippingSettings } from './shipping.service'

const courierToRpc = (err: unknown): never => {
  if (err instanceof CourierError) {
    const detail = err.kind === 'rejected' ? err.message : describeCourierFailure(err)
    throw new ORPCError('BAD_REQUEST', { message: detail })
  }
  if (err instanceof Error) throw new ORPCError('BAD_REQUEST', { message: err.message })
  throw err
}

async function requireProvider(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
) {
  const provider = primaryShippingProvider(
    registry,
    await loadShippingSettings(tx, storeId),
    secret,
  )
  if (!provider) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Enable a courier first.' })
  }
  return provider
}

export type ShipmentListFilter = {
  page: number
  perPage: number
  search?: string | undefined
  status?: string[] | undefined
  ndrStatus?: string[] | undefined
  provider?: string | undefined
}

/** The Shipments workspace's list: every shipment with its order number, filterable and searchable. */
export async function listShipments(tx: StoreTx, input: ShipmentListFilter) {
  const where = and(
    input.search
      ? or(ilike(shipment.waybill, `%${input.search}%`), ilike(order.email, `%${input.search}%`))
      : undefined,
    input.status?.length ? inArray(shipment.status, input.status as never[]) : undefined,
    input.ndrStatus?.length ? inArray(shipment.ndrStatus, input.ndrStatus as never[]) : undefined,
    input.provider ? eq(shipment.provider, input.provider) : undefined,
  )
  const base = tx
    .select({
      id: shipment.id,
      orderId: shipment.orderId,
      orderNumber: order.number,
      email: order.email,
      provider: shipment.provider,
      waybill: shipment.waybill,
      status: shipment.status,
      ndrStatus: shipment.ndrStatus,
      insured: shipment.insured,
      labelUrl: shipment.labelUrl,
      trackingUrl: shipment.trackingUrl,
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
    })
    .from(shipment)
    .innerJoin(order, eq(order.id, shipment.orderId))
    .where(where)
  const [countRow] = await tx
    .select({ total: count() })
    .from(shipment)
    .innerJoin(order, eq(order.id, shipment.orderId))
    .where(where)
  const items = await base
    .orderBy(desc(shipment.createdAt))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  return { items, total: countRow?.total ?? 0 }
}

export async function bulkBookShipments(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  input: {
    orderIds: string[]
    weightGrams?: number | undefined
    dimensionsCm?: { length: number; width: number; height: number } | undefined
    insured?: boolean | undefined
  },
) {
  const provider = await requireProvider(tx, storeId, registry, secret)
  return bulkCreateShipments({ storeId, tx }, provider, input.orderIds, {
    weightGrams: input.weightGrams,
    dimensionsCm: input.dimensionsCm,
    insured: input.insured,
  })
}

export async function schedulePickupForStore(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  input: { shipmentIds: string[]; date: string; timeFrom: string; timeTo?: string | undefined },
) {
  const provider = await requireProvider(tx, storeId, registry, secret)
  const settings = await loadShippingSettings(tx, storeId)
  return schedulePickup({ storeId, tx }, provider, {
    ...input,
    pickupLocationName: settings.policy.warehouse.name || 'Warehouse',
  }).catch(courierToRpc)
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
  const provider = await requireProvider(tx, storeId, registry, secret)
  return applyNdrAction({ storeId, tx }, provider, input.shipmentId, input.action, input).catch(
    courierToRpc,
  )
}

export async function getWalletCard(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
) {
  const provider = await requireProvider(tx, storeId, registry, secret)
  const [wallet, settings] = await Promise.all([
    getWalletBalance({ storeId, tx }, provider.id),
    loadShippingSettings(tx, storeId),
  ])
  return {
    provider: provider.id,
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
}

export async function refreshWallet(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  lowBalanceThresholdPaise?: number,
) {
  const provider = await requireProvider(tx, storeId, registry, secret)
  return refreshWalletBalance({ storeId, tx }, provider, lowBalanceThresholdPaise)
}

export async function recordWallet(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  balancePaise: number,
) {
  const provider = await requireProvider(tx, storeId, registry, secret)
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
