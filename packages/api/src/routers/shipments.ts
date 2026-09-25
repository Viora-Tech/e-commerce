import { loadEnv } from '@commerce/config'
import { permissions } from '@commerce/core'
import { z } from 'zod'
import { can } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import {
  actOnNdr,
  bulkBookShipments,
  compareRatesForOrders,
  createManifestForStore,
  listManifestsForStore,
  listNdrForStore,
  listPickupsForStore,
  listShipments,
  listUnpickedForStore,
  listWalletCards,
  recordWallet,
  refreshWallet,
  resolveOrderNumbers,
  schedulePickupForStore,
} from '../services/shipments-workspace.service'

const secret = () => loadEnv(process.env).SETTINGS_SECRET

const ndrAction = z.enum(['reattempt', 'change_address', 'rto'])

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
        perPage: z.number().int().min(1).max(100).default(25),
        search: z.string().trim().max(200).optional(),
        status: z.array(z.string()).optional(),
        ndrStatus: z.array(z.string()).optional(),
        provider: z.string().optional(),
      }),
    )
    .handler(({ context, input }) => listShipments(context.tx, input)),

  resolveOrderNumbers: can(permissions.ORDERS_READ)
    .input(z.object({ numbers: z.array(z.number().int()).min(1).max(200) }))
    .handler(({ context, input }) => resolveOrderNumbers(context.tx, input.numbers)),

  bulkBook: can(permissions.ORDERS_FULFIL)
    .input(
      z.object({
        orderIds: z.array(z.uuid()).min(1).max(200),
        weightGrams: z.number().int().min(1).optional(),
        dimensionsCm: z
          .object({
            length: z.number().min(1),
            width: z.number().min(1),
            height: z.number().min(1),
          })
          .optional(),
        insured: z.boolean().optional(),
        /** orderId -> providerId. Orders left out book with the store's default courier rule. */
        courierOverrides: z.record(z.uuid(), z.string().min(1)).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return bulkBookShipments(context.tx, context.scope.storeId, shipping, secret(), input)
    }),

  /** The bulk-book panel's rate comparison table: every connected courier's price and ETA
   *  to each order's own address, for showing Cheapest / Fastest / Recommended before booking. */
  compareRates: can(permissions.ORDERS_READ)
    .input(
      z.object({
        orderIds: z.array(z.uuid()).min(1).max(100),
        weightGrams: z.number().int().min(1).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return compareRatesForOrders(
        context.tx,
        context.scope.storeId,
        shipping,
        secret(),
        input.orderIds,
        input.weightGrams,
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
      return schedulePickupForStore(context.tx, context.scope.storeId, shipping, secret(), input)
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
      return createManifestForStore(context.tx, context.scope.storeId, shipping, secret(), input)
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
      return actOnNdr(context.tx, context.scope.storeId, shipping, secret(), input)
    }),

  /** One card per connected courier - each has its own account and balance. */
  wallets: can(permissions.ORDERS_READ).handler(async ({ context }) => {
    const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
    return listWalletCards(context.tx, context.scope.storeId, shipping, secret())
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
        secret(),
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
        secret(),
        input.providerId,
        input.balancePaise,
      )
    }),
}
