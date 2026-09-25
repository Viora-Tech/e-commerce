import {
  applyNdrAction,
  bulkCreateShipments,
  type CourierRateRow,
  chooseCourier,
  compareCourierRates,
  createManifest,
  createShipmentForOrder,
  getWalletBalance,
  listUnpickedShipments,
  primaryShippingProvider,
  recordWalletBalance,
  refreshWalletBalance,
  resolveShippingProviders,
  type ShippingRegistry,
  schedulePickup,
  shippingProviderById,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { address, order, shipment, shipmentManifest, shipmentPickup, store } from '@commerce/db'
import {
  ASSUMED_WEIGHT_GRAMS,
  CourierError,
  describeCourierFailure,
  type NdrAction,
  type RateQuery,
} from '@commerce/shipping'
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

/** The courier that actually holds a shipment's waybill - by the id stored on the row, not
 *  whichever courier happens to be first in the enabled list. Required for any action on an
 *  *existing* shipment (NDR, cancel, tracking) once a store has more than one courier connected. */
async function requireProviderById(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  providerId: string,
) {
  const provider = shippingProviderById(
    registry,
    await loadShippingSettings(tx, storeId),
    secret,
    providerId,
  )
  if (!provider) {
    throw new ORPCError('PRECONDITION_FAILED', {
      message: `Courier ${providerId} is no longer enabled.`,
    })
  }
  return provider
}

type OrderShippingContext = {
  orderId: string
  orderNumber: number
  pincode: string
  stateCode: string | null
  totalPaise: number
  paymentMethod: string | null
}

/** Destination, value and payment mode for a batch of orders, joined once rather than per order.
 *  Orders with no shipping address are silently skipped here - the caller reports them as
 *  individual booking failures, same as `createShipmentForOrder` does for a single order. */
async function loadOrderShippingContexts(
  tx: StoreTx,
  orderIds: string[],
): Promise<OrderShippingContext[]> {
  if (orderIds.length === 0) return []
  const rows = await tx
    .select({
      orderId: order.id,
      orderNumber: order.number,
      totalPaise: order.totalPaise,
      paymentMethod: order.paymentMethod,
      pincode: address.pincode,
      stateCode: address.stateCode,
    })
    .from(order)
    .innerJoin(address, eq(address.id, order.shippingAddressId))
    .where(inArray(order.id, orderIds))
  return rows
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

/**
 * Rate comparison for a batch of orders (the bulk-book panel's preview table
 * and the per-order "compare couriers" view): every connected courier's price
 * and transit time to each order's own address. One courier's failure never
 * blanks another order's row - see `compareCourierRates`.
 */
export async function compareRatesForOrders(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  orderIds: string[],
  weightGrams?: number | undefined,
): Promise<
  Array<{
    orderId: string
    orderNumber: number
    stateCode: string | null
    options: CourierRateRow[]
  }>
> {
  const settings = await loadShippingSettings(tx, storeId)
  const { providers } = resolveShippingProviders(registry, settings, secret)
  if (providers.length === 0) return []
  const contexts = await loadOrderShippingContexts(tx, orderIds)
  return Promise.all(
    contexts.map(async (o) => {
      const query: RateQuery = {
        originPincode: settings.policy.originPincode,
        destinationPincode: o.pincode,
        weightGrams: weightGrams ?? ASSUMED_WEIGHT_GRAMS,
        declaredValuePaise: o.totalPaise,
        paymentMode: o.paymentMethod === 'cod' ? 'cod' : 'prepaid',
      }
      const options = await compareCourierRates(providers, query)
      return { orderId: o.orderId, orderNumber: o.orderNumber, stateCode: o.stateCode, options }
    }),
  )
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
    /** Merchant's per-row courier pick from the rate comparison table; orders not listed here
     *  book with the store's default rule (`settings.courierRule`). */
    courierOverrides?: Record<string, string> | undefined
  },
) {
  const settings = await loadShippingSettings(tx, storeId)
  const { providers } = resolveShippingProviders(registry, settings, secret)
  if (providers.length === 0) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Enable a courier first.' })
  }

  // Single-courier stores skip rate comparison entirely - there is nothing to choose between.
  if (providers.length === 1) {
    return bulkCreateShipments(
      { storeId, tx },
      providers[0] as (typeof providers)[0],
      input.orderIds,
      {
        weightGrams: input.weightGrams,
        dimensionsCm: input.dimensionsCm,
        insured: input.insured,
      },
    )
  }

  const contexts = await loadOrderShippingContexts(tx, input.orderIds)
  const found = new Set(contexts.map((c) => c.orderId))
  const results: Array<{
    orderId: string
    ok: boolean
    shipmentId?: string
    waybill?: string
    error?: string
  }> = []

  for (const o of contexts) {
    try {
      const overrideId = input.courierOverrides?.[o.orderId]
      let provider = overrideId ? providers.find((p) => p.id === overrideId) : undefined
      if (!provider) {
        const query: RateQuery = {
          originPincode: settings.policy.originPincode,
          destinationPincode: o.pincode,
          weightGrams: input.weightGrams ?? ASSUMED_WEIGHT_GRAMS,
          declaredValuePaise: o.totalPaise,
          paymentMode: o.paymentMethod === 'cod' ? 'cod' : 'prepaid',
        }
        const options = await compareCourierRates(providers, query)
        provider =
          chooseCourier(options, providers, settings.courierRule, { stateCode: o.stateCode }) ??
          providers[0]
      }
      const row = await createShipmentForOrder(
        { storeId, tx },
        provider as (typeof providers)[0],
        o.orderId,
        {
          weightGrams: input.weightGrams,
          dimensionsCm: input.dimensionsCm,
          insured: input.insured,
        },
      )
      results.push({ orderId: o.orderId, ok: true, shipmentId: row.id, waybill: row.waybill })
    } catch (err) {
      results.push({
        orderId: o.orderId,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  for (const id of input.orderIds) {
    if (!found.has(id))
      results.push({ orderId: id, ok: false, error: 'Order has no shipping address.' })
  }
  return results
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
