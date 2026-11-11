/** SOURCE OF TRUTH: courierToRpc, requireProvider, requireProviderById
 * WHAT:  The courier a shipment action talks to (the store's first enabled one, or the one that
 *        holds a waybill), and a courier failure turned into an RPC error the admin can show.
 * WHY:   Split from `./shipments-workspace.service` (the Shipments lists) by concern.
 * WHERE: `./shipments-operations.service` (cancel, NDR, pickups, tracking, wallet).
 */
import {
  primaryShippingProvider,
  type ShippingRegistry,
  shippingProviderById,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { CourierError, describeCourierFailureForStaff } from '@commerce/shipping'
import { ORPCError } from '@orpc/server'
import { loadShippingSettings } from './shipping.service'

export const courierToRpc = (err: unknown): never => {
  if (err instanceof CourierError) {
    const detail = describeCourierFailureForStaff(err)
    throw new ORPCError('BAD_REQUEST', { message: detail })
  }
  if (err instanceof Error) throw new ORPCError('BAD_REQUEST', { message: err.message })
  throw err
}

export async function requireProvider(
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
export async function requireProviderById(
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
