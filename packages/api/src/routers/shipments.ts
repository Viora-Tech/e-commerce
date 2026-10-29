import { settingsSecret } from '@commerce/config'
import { permissions } from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { BULK_MAX, can, heavy, PAGE_SIZE_MAX, SEARCH_MAX } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import { prepareShipments, quoteShipments } from '../services/create-shipment.service'
import { indiaPostLabel, recordShipmentStatus } from '../services/india-post.service'
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
  SHIPMENT_NDR_STATUSES,
  shipmentCounts,
} from '../services/shipments-workspace.service'
import { shipmentDetails, shipmentLabelFile } from '../services/shipping.service'

const ndrAction = z.enum(['reattempt', 'change_address', 'rto'])

const manualStatus = z.enum([
  'created',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'rto',
])

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
        /** The filter panel's Delivery problem: the shipments' NDR states. */
        ndrStatus: z
          .array(z.enum(SHIPMENT_NDR_STATUSES))
          .max(SHIPMENT_NDR_STATUSES.length)
          .optional(),
        /** The filter panel's Courier. */
        provider: z.string().trim().min(1).max(60).optional(),
        bookedFrom: z.iso.datetime().optional(),
        bookedTo: z.iso.datetime().optional(),
        paymentMethod: z.enum(['cod', 'prepaid']).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return listShipments(context.tx, input, shipping)
    }),

  /**
   * One booked shipment for its details view: courier and service, AWB, status, COD or
   * prepaid, package, pickup, the label link the admin may open, and whether it can still be
   * cancelled (and why not).
   */
  get: can(permissions.ORDERS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return shipmentDetails(context.tx, shipping, input.id)
    }),

  /**
   * A shipment's label PDF for the admin's `/api/shipments/<id>/label` route: the copy kept in
   * the store's private storage (Blue Dart, DTDC, DHL Express, FedEx), else the courier's own,
   * fetched server-side with the store's saved key (Delhivery), so the key never reaches the
   * browser. Rows are read under the caller's store, so another store's id finds nothing.
   */
  label: can(permissions.ORDERS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      const bytes = await shipmentLabelFile(
        context.tx,
        context.scope.storeId,
        shipping,
        settingsSecret(),
        input.id,
      )
      if (!bytes)
        throw new ORPCError('NOT_FOUND', { message: 'No label on file for this shipment.' })
      return new File([bytes as Uint8Array<ArrayBuffer>], `label-${input.id}.pdf`, {
        type: 'application/pdf',
      })
    }),

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

  /**
   * A status set by hand, for a courier with no tracking feed (India Post): appended to the
   * shipment's timeline and applied like a scan (delivered closes the order, RTO opens its task).
   */
  recordStatus: can(permissions.ORDERS_FULFIL)
    .input(
      z.object({
        shipmentId: z.uuid(),
        status: manualStatus,
        description: z.string().trim().min(1).max(200),
        location: z.string().trim().max(120).optional(),
        at: z.iso.datetime({ offset: true }).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      const { shipmentId, ...event } = input
      return recordShipmentStatus(
        context.tx,
        context.scope.storeId,
        shipping,
        settingsSecret(),
        shipmentId,
        event,
      )
    }),

  /** Our own India Post address label (Code 128 article number), as a PDF. */
  indiaPostLabel: can(permissions.ORDERS_READ)
    .input(z.object({ waybill: z.string().trim().min(1).max(40) }))
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      const label = await indiaPostLabel(
        context.tx,
        context.scope.storeId,
        shipping,
        settingsSecret(),
        input.waybill.toUpperCase(),
      )
      return new File([label.bytes as Uint8Array<ArrayBuffer>], label.name, {
        type: 'application/pdf',
      })
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
