import {
  applyTracking,
  cancelShipment,
  createShipmentForOrder,
  estimateForStore,
  parseShippingSettings,
  primaryShippingProvider,
  type ShippingRegistry,
  type ShippingSettings,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { shipment, store } from '@commerce/db'
import { CourierError, describeCourierFailure } from '@commerce/shipping'
import { ORPCError } from '@orpc/server'
import { eq } from 'drizzle-orm'

export async function updateStoreShipping(tx: StoreTx, storeId: string, shipping: unknown) {
  const [s] = await tx.update(store).set({ shipping }).where(eq(store.id, storeId)).returning()
  return s ?? null
}

export async function loadShippingSettings(
  tx: StoreTx,
  storeId: string,
): Promise<ShippingSettings> {
  const [s] = await tx.select({ shipping: store.shipping }).from(store).where(eq(store.id, storeId))
  return parseShippingSettings(s?.shipping)
}

export async function getShipmentForOrder(tx: StoreTx, orderId: string) {
  const [row] = await tx.select().from(shipment).where(eq(shipment.orderId, orderId))
  return row ?? null
}

/** The merchant's own "try a PIN" panel: the same composition the storefront uses. */
export async function tryEstimate(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  pincode: string,
) {
  const settings = await loadShippingSettings(tx, storeId)
  return estimateForStore({ registry, settings, secret, pincode })
}

/** Ask the store's primary courier whether its saved credentials work. */
export async function verifyShippingCredentials(
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
  if (!provider) return { ok: false, message: 'No courier is enabled.' }
  return provider.verifyCredentials()
}

/** Courier failures become BAD_REQUEST with the app's wording; the courier's never reaches the UI raw. */
const courierToRpc = (err: unknown): never => {
  if (err instanceof CourierError) {
    const detail = err.kind === 'rejected' ? err.message : describeCourierFailure(err)
    throw new ORPCError('BAD_REQUEST', { message: detail })
  }
  throw err
}

export async function bookShipment(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  orderId: string,
) {
  const provider = primaryShippingProvider(
    registry,
    await loadShippingSettings(tx, storeId),
    secret,
  )
  if (!provider)
    throw new ORPCError('PRECONDITION_FAILED', {
      message: 'Enable a courier in Settings › Shipping first.',
    })
  return createShipmentForOrder({ storeId, tx }, provider, orderId).catch(courierToRpc)
}

export async function refreshShipmentTracking(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  shipmentId: string,
) {
  const [row] = await tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!row) throw new ORPCError('NOT_FOUND')
  const provider = primaryShippingProvider(
    registry,
    await loadShippingSettings(tx, storeId),
    secret,
  )
  if (!provider || provider.id !== row.provider) {
    throw new ORPCError('PRECONDITION_FAILED', {
      message: `Courier ${row.provider} is no longer enabled.`,
    })
  }
  const tracking = await provider.track(row.waybill).catch(courierToRpc)
  return applyTracking({ storeId, tx }, shipmentId, tracking)
}

export async function cancelStoreShipment(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  shipmentId: string,
) {
  const [row] = await tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!row) throw new ORPCError('NOT_FOUND')
  const provider = primaryShippingProvider(
    registry,
    await loadShippingSettings(tx, storeId),
    secret,
  )
  if (!provider || provider.id !== row.provider) {
    throw new ORPCError('PRECONDITION_FAILED', {
      message: `Courier ${row.provider} is no longer enabled.`,
    })
  }
  return cancelShipment({ storeId, tx }, provider, shipmentId).catch(courierToRpc)
}
