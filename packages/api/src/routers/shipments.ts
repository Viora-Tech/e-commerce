import { settingsSecret } from '@commerce/config'
import { permissions } from '@commerce/core'
import { z } from 'zod'
import { BULK_MAX, can, heavy, PAGE_SIZE_MAX, SEARCH_MAX } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import { prepareShipments, quoteShipments } from '../services/create-shipment.service'
import {
  actOnNdr,
  createManifestForStore,
  listManifestsForStore,
  listNdrForStore,
  listPickupsForStore,
  listUnpickedForStore,
  listWalletCards,
  recordWallet,
  refreshWallet,
  resolveOrderNumbers,
  schedulePickupForStore,
} from '../services/shipments-operations.service'
import {
  bulkBookShipments,
  listReadyToShip,
  listShipments,
  shipmentCounts,
} from '../services/shipments-workspace.service'

const ndrAction = z.enum(['reattempt', 'change_address', 'rto'])

const dimensionsCm = z.object({
  length: z.number().min(1),
  width: z.number().min(1),
  height: z.number().min(1),
})

/**
 * The shared Shipments workspace (Orders → Shipments): every shipment across
 * every courier, bulk booking, pickups and manifests, the NDR queue and the
 * wallet card. Order-level book/refresh/cancel stay on `orders.*` (the
 * per-order panel); this router is the cross-order view.
 */
export const shipmentsRouter = {
  list: can(permissions.ORDERS_READ)
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
        search: z.string().trim().max(SEARCH_MAX).optional(),
        status: z.array(z.string()).optional(),
        ndrStatus: z.array(z.string()).optional(),
        provider: z.string().optional(),
      }),
    )
    .handler(({ context, input }) => listShipments(context.tx, input)),

  /** Rows per Shipments tab, plus "booked today" and "need attention" for the summary line. */
  counts: can(permissions.ORDERS_READ).handler(({ context }) => shipmentCounts(context.tx)),

  /** Ready to ship tab: paid, unfulfilled orders - the main Shopify-style booking flow. */
  readyToShip: can(permissions.ORDERS_READ)
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
        search: z.string().trim().max(SEARCH_MAX).optional(),
      }),
    )
    .handler(({ context, input }) => listReadyToShip(context.tx, input)),

  resolveOrderNumbers: can(permissions.ORDERS_READ)
    .input(z.object({ numbers: z.array(z.number().int()).min(1).max(200) }))
    .handler(({ context, input }) => resolveOrderNumbers(context.tx, input.numbers)),

  bulkBook: can(permissions.ORDERS_FULFIL)
    .use(heavy('bulk'))
    .input(
      z.object({
        orderIds: z.array(z.uuid()).min(1).max(BULK_MAX),
        weightGrams: z.number().int().min(1).optional(),
        dimensionsCm: dimensionsCm.optional(),
        insured: z.boolean().optional(),
        /** orderId -> providerId. Orders left out book with the store's default courier rule. */
        courierOverrides: z.record(z.uuid(), z.string().min(1)).optional(),
        /** orderId -> the courier's service picked for it; absent books the courier's default. */
        serviceOverrides: z.record(z.uuid(), z.string().min(1).max(64)).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return bulkBookShipments(context.tx, context.scope.storeId, shipping, settingsSecret(), input)
    }),

  /** Create shipment, step 1: each order's parcels (items, weight, box, pickup place, COD)
   *  and the store's couriers, boxes and pickup places. Reads only; no courier is called. */
  prepare: can(permissions.ORDERS_READ)
    .input(z.object({ orderIds: z.array(z.uuid()).min(1).max(BULK_MAX) }))
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return prepareShipments(
        context.tx,
        context.scope.storeId,
        shipping,
        settingsSecret(),
        input.orderIds,
      )
    }),

  /** Create shipment, step 2: every connected courier's price, delivery date and COD support
   *  per parcel, with Cheapest / Fastest / Recommended. One courier's failure is its own row. */
  quote: can(permissions.ORDERS_READ)
    .use(heavy('bulk'))
    .input(
      z.object({
        parcels: z
          .array(
            z.object({
              orderId: z.uuid(),
              fulfillmentOrderId: z.guid().nullish(),
              pickupLocationId: z.uuid().nullish(),
              weightGrams: z.number().int().min(1).optional(),
              dimensionsCm: dimensionsCm.optional(),
              paymentMode: z.enum(['cod', 'prepaid']).optional(),
              declaredValuePaise: z.number().int().min(0).optional(),
            }),
          )
          .min(1)
          .max(BULK_MAX),
      }),
    )
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return quoteShipments(
        context.tx,
        context.scope.storeId,
        shipping,
        settingsSecret(),
        input.parcels,
      )
    }),

  schedulePickup: can(permissions.ORDERS_FULFIL)
    .input(
      z.object({
        shipmentIds: z.array(z.uuid()).min(1).max(500),
        date: z.string(),
        timeFrom: z.string(),
        timeTo: z.string().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return schedulePickupForStore(
        context.tx,
        context.scope.storeId,
        shipping,
        settingsSecret(),
        input,
      )
    }),

  listPickups: can(permissions.ORDERS_READ).handler(({ context }) =>
    listPickupsForStore(context.tx, context.scope.storeId),
  ),

  listUnpicked: can(permissions.ORDERS_READ).handler(({ context }) =>
    listUnpickedForStore(context.tx, context.scope.storeId),
  ),

  createManifest: can(permissions.ORDERS_FULFIL)
    .input(
      z.object({
        pickupId: z.uuid().optional(),
        shipmentIds: z.array(z.uuid()).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return createManifestForStore(
        context.tx,
        context.scope.storeId,
        shipping,
        settingsSecret(),
        input,
      )
    }),

  listManifests: can(permissions.ORDERS_READ).handler(({ context }) =>
    listManifestsForStore(context.tx, context.scope.storeId),
  ),

  listNdr: can(permissions.ORDERS_READ).handler(({ context }) =>
    listNdrForStore(context.tx, context.scope.storeId),
  ),

  ndrAction: can(permissions.ORDERS_FULFIL)
    .input(
      z.object({
        shipmentId: z.uuid(),
        action: ndrAction,
        name: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        comment: z.string().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return actOnNdr(context.tx, context.scope.storeId, shipping, settingsSecret(), input)
    }),

  /** One card per connected courier - each has its own account and balance. */
  wallets: can(permissions.ORDERS_READ).handler(async ({ context }) => {
    const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
    return listWalletCards(context.tx, context.scope.storeId, shipping, settingsSecret())
  }),

  refreshWallet: can(permissions.ORDERS_FULFIL)
    .input(
      z.object({
        providerId: z.string().min(1),
        lowBalanceThresholdPaise: z.number().int().min(0).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return refreshWallet(
        context.tx,
        context.scope.storeId,
        shipping,
        settingsSecret(),
        input.providerId,
        input.lowBalanceThresholdPaise,
      )
    }),

  recordWalletBalance: can(permissions.ORDERS_FULFIL)
    .input(z.object({ providerId: z.string().min(1), balancePaise: z.number().int().min(0) }))
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return recordWallet(
        context.tx,
        context.scope.storeId,
        shipping,
        settingsSecret(),
        input.providerId,
        input.balancePaise,
      )
    }),
}
