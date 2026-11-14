/** SOURCE OF TRUTH: a courier app's own pages — WHAT: Overview tiles and Pickup locations for one courier's shipments in this store / WHY: kept out of shipments.ts (500-line cap) and spread into `shipmentsRouter`, so the paths stay `shipments.courierOverview` and `shipments.courierPickupPlaces`. */
import { permissions } from '@commerce/core'
import { z } from 'zod'
import { can } from '../procedures'
import { courierOverview, courierPickupPlaces } from '../services/courier-overview.service'

const provider = z.object({ provider: z.string().trim().min(1).max(60) })

/**
 * A pickup start or end time as couriers take it (`shipments.schedulePickup`): 24h "14:00" (or
 * "14:00:00"). Anything else ("2 pm", typed in the Pickups tab's box) only comes back refused.
 */
export const pickupTime = z
  .string()
  .trim()
  .regex(/^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Type the pickup time as 24h, e.g. 14:00.')

export const courierAppProcedures = {
  /** A courier app's Overview tiles: in transit and delayed, booked today and what it cost,
   *  RTO this month, and its newest shipment change. This store's shipments with that courier. */
  courierOverview: can(permissions.ORDERS_READ)
    .input(provider)
    .handler(({ context, input }) =>
      courierOverview(context.tx, context.scope.storeId, input.provider),
    ),

  /** A courier app's Pickup locations: the account's own place, then every location with
   *  courier pickup on, each with the next pickup booked there with that courier. */
  courierPickupPlaces: can(permissions.ORDERS_READ)
    .input(provider)
    .handler(({ context, input }) =>
      courierPickupPlaces(context.tx, context.scope.storeId, input.provider),
    ),
}
