import { settingsSecret } from '@commerce/config'
import {
  CommerceError,
  CourierChargeInputSchema,
  courierOrdersForOrder,
  deleteTestOrders,
  deliverGiftCard,
  giftCardChannels,
  isIsoDay,
  MANUAL_PAYMENT_METHODS,
  ORDER_MARKS,
  OrderNotFound,
  orderPartShipping,
  orderProfit,
  payOrderWithStoreCredit,
  permissions,
  REFUND_METHODS,
  setCourierCharge,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can, inputField, PAGE_SIZE_MAX } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import { retryCourierPushForOrder } from '../services/courier-push.service'
import {
  addOrderNote,
  captureOrderPayment,
  getOrder,
  listOrderIds,
  listOrderLinePeek,
  listOrders,
  orderCouriers,
  orderFacets,
  orderStats,
  orderTabCounts,
  orderTiles,
  readyToShipCount,
  refundOrderPayment,
  setOrderStatus,
} from '../services/order.service'
import {
  collectOrderPayment,
  customerOrderCount,
  customerOrderIndex,
  fulfilOrder,
  orderBalance,
  orderNeighbours,
} from '../services/order-fulfil.service'
import {
  assertCourierConnected,
  bookShipment,
  cancelStoreShipment,
  refreshShipmentTracking,
  shipmentDetailsForOrder,
} from '../services/shipping.service'
import { courierArgs } from './courier-args'
import { assertNotImported } from './imported-order'
import { orderContactRoutes } from './order-contact'
import { draftAndAbandonedRoutes } from './order-drafts'
import { orderEditRoutes } from './order-edit'
import { orderHoldRoutes } from './order-hold'
import { orderListRoutes } from './order-list'
import { listFilters } from './order-list-filters'
import { orderMessageRoutes } from './order-messages'
import { orderUndoRoutes } from './order-undo'

/** What "Mark as" on the order page records; the statuses are then derived. */
const change = z.enum(ORDER_MARKS)

export const ordersRouter = {
  /** Orders, a page at a time, by list tab, status, payment, fulfilment, date, product or a search. */
  list: can(permissions.ORDERS_READ)
    .input(
      listFilters.extend({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
        status: z.enum(['open', 'completed', 'cancelled']).optional(),
      }),
    )
    .handler(({ context, input }) => listOrders(context.tx, input)),

  /** Every order id the list's filters match (the table's "Select all N orders"), up to 5,000. */
  ids: can(permissions.ORDERS_READ)
    .input(listFilters)
    .handler(({ context, input }) => listOrderIds(context.tx, input)),

  /** An order's lines with pictures, for the list's items popover (up to 20). */
  linePeek: can(permissions.ORDERS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => listOrderLinePeek(context.tx, input.id)),

  /** The couriers the store's orders went with (the filter panel's Courier select). */
  couriers: can(permissions.ORDERS_READ).handler(({ context }) => orderCouriers(context.tx)),

  /** What the Orders filter panel offers: tags, discount codes, couriers and collections in use. */
  facets: can(permissions.ORDERS_READ).handler(({ context }) => orderFacets(context.tx)),

  /**
   * "Delete test orders": removes every order of this store paid on a gateway's test keys
   * (`is_test`), with its dependent rows. Real orders are never touched. Returns the count.
   */
  deleteTestOrders: can(permissions.ORDERS_CANCEL).handler(async ({ context }) => ({
    deleted: await deleteTestOrders({ tx: context.tx, storeId: context.scope.storeId }),
  })),

  /** The order stats for the last 7 days, against the 7 days before. */
  stats: can(permissions.ORDERS_READ).handler(({ context }) => orderStats(context.tx)),

  /** The Orders tab badges (All, Unpaid, Unfulfilled, Pending UPI) in one query. */
  tabCounts: can(permissions.ORDERS_READ).handler(({ context }) => orderTabCounts(context.tx)),

  /** The stat cards above the Orders list. */
  tiles: can(permissions.ORDERS_READ).handler(({ context }) => orderTiles(context.tx)),

  /** How many orders are waiting to ship. */
  toShipCount: can(permissions.ORDERS_READ).handler(({ context }) => readyToShipCount(context.tx)),
  /** One order: lines, payments, shipment, pending courier orders, balance, parts, order history. */
  /** One order with its lines, payments, shipment, balance due and the customer's order history. */
  get: can(permissions.ORDERS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const o = await getOrder(context.tx, input.id)
      if (!o) return null
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      const [shipment, balance, customerOrders, customerOrderNumber, courierOrders, partShipping] =
        await Promise.all([
          shipmentDetailsForOrder(context.tx, shipping, input.id),
          orderBalance(context.tx, input.id, o.totalPaise),
          customerOrderCount(context.tx, o.customerId),
          customerOrderIndex(context.tx, o.customerId, o.placedAt),
          courierOrdersForOrder({ storeId: context.scope.storeId, tx: context.tx }, input.id),
          orderPartShipping(context.tx, input.id, o.parcels, shipping),
        ])
      const extras = { shipment, balance, customerOrders, customerOrderNumber, courierOrders }
      return { ...o, ...extras, partShipping }
    }),

  /** Send the order to a courier's panel again after it refused (order push). */
  retryCourierPush: can(permissions.ORDERS_WRITE)
    .input(z.object({ orderId: z.uuid(), provider: z.string().min(1).max(40) }))
    .handler(async ({ context, input }) => {
      return retryCourierPushForOrder(...(await courierArgs(context)), input)
    }),

  /** What the order earned: net sales less goods, courier, fees and RTO (order/profit.ts). */
  profit: can(permissions.ANALYTICS_READ)
    .input(z.object({ orderId: z.uuid() }))
    .handler(({ context, input }) =>
      orderProfit({ storeId: context.scope.storeId, tx: context.tx }, input.orderId),
    ),

  /** What the courier charged for a consignment, typed by the merchant. */
  setCourierCharge: can(permissions.ORDERS_WRITE)
    .input(CourierChargeInputSchema)
    .handler(({ context, input }) =>
      setCourierCharge({ storeId: context.scope.storeId, tx: context.tx }, input),
    ),

  /** Order numbers either side of this one, for the arrows in the detail header. */
  neighbours: can(permissions.ORDERS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => orderNeighbours(context.tx, input.id)),

  /** Pack some or all of the lines; the shopper is told once the parcel is complete. */
  fulfil: can(permissions.ORDERS_FULFIL)
    .input(
      z.object({
        orderId: z.uuid(),
        lines: z.array(z.object({ lineId: z.uuid(), quantity: z.number().int().min(0) })).min(1),
        courier: z.string().trim().max(60).optional(),
        /** A connected courier app the AWB was booked in from its own panel. */
        providerId: z.string().trim().max(60).optional(),
        trackingNumber: z.string().trim().max(60).optional(),
        // Shown as a link to the shopper and in emails: web links only, never javascript: or data:.
        trackingUrl: z
          .url({ protocol: /^https?$/ })
          .max(500)
          .optional(),
        /** False: pack without the "order shipped" message (Shopify's "Notify customer"). */
        notifyCustomer: z.boolean().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await assertNotImported(context.tx, { orderId: input.orderId })
      if (input.providerId) {
        const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
        const { storeId } = context.scope
        await assertCourierConnected(
          context.tx,
          storeId,
          shipping,
          settingsSecret(),
          input.providerId,
        )
      }
      try {
        // order.fulfilled is written by the recompute inside, on the last unit packed.
        return await fulfilOrder(context.tx, context.scope.storeId, input)
      } catch (err) {
        if (err instanceof CommerceError)
          throw new ORPCError('BAD_REQUEST', { message: err.message })
        throw err
      }
    }),

  /** Record money collected outside a gateway; the order becomes paid. */
  collectPayment: can(permissions.ORDERS_WRITE)
    .input(
      z.object({
        orderId: z.uuid(),
        amountPaise: z.number().int().positive(),
        // Money collected by hand is `manual` or `cod`; a gateway's name here would make it
        // read as automatic gateway money in "Payments by method".
        method: z.enum(['manual', 'cod']).optional(),
        /** How the merchant was paid: shown on the timeline and in "Payments by method". */
        paidWith: z.enum(MANUAL_PAYMENT_METHODS).optional(),
        /** UTR, cheque number or bank reference. */
        reference: z.string().trim().max(80).optional(),
        /** The day the money arrived, `YYYY-MM-DD`. */
        receivedOn: z.string().refine(isIsoDay, 'Pick a date').optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await assertNotImported(context.tx, { orderId: input.orderId })
      const { paidWith, reference, receivedOn, ...rest } = input
      const collected = paidWith
        ? {
            method: paidWith,
            reference,
            receivedOn,
            recordedBy: context.session.user.email,
            recordedAt: new Date().toISOString(),
          }
        : undefined
      // order.paid (or order.balance_paid for a pre-order balance) is written
      // inside, by the call that sees the money arrive.
      const ctx = { storeId: context.scope.storeId, tx: context.tx }
      const { order: o } = await collectOrderPayment(ctx.tx, ctx.storeId, { ...rest, collected })
        .then(async (done) => {
          // Store credit: the balance pays; too low, and the whole collection rolls back.
          if (paidWith === 'store_credit') {
            const staff = { userId: context.scope.userId, email: context.session.user.email }
            await payOrderWithStoreCredit(ctx, {
              orderId: input.orderId,
              amountPaise: input.amountPaise,
              staff,
            })
          }
          return done
        })
        .catch((err) => {
          if (err instanceof OrderNotFound) {
            throw new ORPCError('NOT_FOUND', { message: 'Order not found' })
          }
          if (err instanceof CommerceError) {
            throw new ORPCError('BAD_REQUEST', { message: err.message })
          }
          throw err
        })
      return o
    }),

  /** Book the parcel with the courier picked in the Create shipment flow (the store's first
   *  courier when none is named); the parcel's items are packed and the shopper is told. */
  createShipment: can(permissions.ORDERS_FULFIL)
    .input(
      z.object({
        orderId: z.uuid(),
        providerId: z.string().min(1).optional(),
        /** The courier's service picked in the rate table (Delhivery Express, a Shiprocket carrier). */
        serviceId: z.string().min(1).max(64).optional(),
        /** That service's name as the rate table showed it, kept for the shipment details view. */
        serviceLabel: z.string().trim().min(1).max(80).optional(),
        /** The article number from the counter receipt, for a courier booked at its counter (India Post). */
        trackingNumber: z.string().trim().min(1).max(40).optional(),
        fulfillmentOrderId: z.guid().optional(),
        /** A location id, or null for Settings Ã¢â‚¬Âº Shipping's address; omitted picks for you. */
        pickupLocationId: z.uuid().nullish(),
        weightGrams: z.number().int().min(1).optional(),
        dimensionsCm: z
          .object({
            length: z.number().min(1),
            width: z.number().min(1),
            height: z.number().min(1),
          })
          .optional(),
        paymentMode: z.enum(['cod', 'prepaid']).optional(),
        codAmountPaise: z.number().int().min(0).optional(),
        insured: z.boolean().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await assertNotImported(context.tx, { orderId: input.orderId })
      // Booking packs what is left; the recompute writes order.fulfilled only
      // if this is what completed the packing.
      const { orderId, ...choice } = input
      return bookShipment(...(await courierArgs(context)), orderId, choice)
    }),

  /** Fetch the latest tracking events for a shipment from its courier. */
  refreshTracking: can(permissions.ORDERS_READ)
    .input(z.object({ shipmentId: z.uuid() }))
    .handler(async ({ context, input }) => {
      return refreshShipmentTracking(...(await courierArgs(context)), input.shipmentId)
    }),

  /**
   * Cancel a booked shipment with its courier, before it is collected or put on a manifest. The
   * order timeline records who did it, and the parcel can be booked again.
   */
  cancelShipment: can(permissions.ORDERS_FULFIL)
    .input(z.object({ shipmentId: z.uuid() }))
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return cancelStoreShipment(
        context.tx,
        context.scope.storeId,
        shipping,
        settingsSecret(),
        input.shipmentId,
        context.session.user.email,
      )
    }),

  /** "Mark as paid / fulfilled / delivered", or cancel. Events follow the derived transitions. */
  // Cancelling is its own grant (and its own "Needs approval" tick), as on `orders.cancel`.
  // Fulfilled and delivered pack what is left, so they need the pack form's grant too.
  setStatus: can(permissions.ORDERS_WRITE, (input) => {
    const status = inputField(input, 'status')
    if (status === 'cancelled') return [permissions.ORDERS_CANCEL]
    return status === 'fulfilled' || status === 'delivered' ? [permissions.ORDERS_FULFIL] : []
  })
    .input(
      z.object({
        id: z.uuid(),
        status: change,
        /** False: the shopper is not told (Mark as delivered's "Notify customer"). */
        notifyCustomer: z.boolean().optional(),
        /** Delivered only if it already went out (bulk Mark as delivered); else BAD_REQUEST. */
        onlyShipped: z.boolean().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await assertNotImported(context.tx, { orderId: input.id })
      const { id, status, ...opts } = input
      const o = await setOrderStatus(context.tx, context.scope.storeId, id, status, opts).catch(
        (err) => {
          if (err instanceof CommerceError) {
            throw new ORPCError('BAD_REQUEST', { message: err.message })
          }
          throw err
        },
      )
      return o
    }),

  /** Send money back through the gateway (or record a cash/UPI refund); partial amounts allowed. */
  refund: can(permissions.ORDERS_REFUND)
    .input(
      z.object({
        paymentId: z.uuid(),
        amountPaise: z.number().int().positive(),
        reason: z.string().trim().max(500).optional(),
        /** Record it as sent back by hand instead of asking the gateway. */
        manual: z.boolean().optional(),
        /** How it went back when recorded by hand; `store_credit` adds it to the customer's store credit balance. */
        method: z.enum(REFUND_METHODS).optional(),
        storeCreditExpiresOn: z.iso.date().nullish(), // last day or null; see `refundPayment`
      }),
    )
    .handler(async ({ context, input }) => {
      // Imported order: its money was taken elsewhere, so only by hand or as store credit here.
      const handOnly = input.manual === true || input.method === 'store_credit'
      if (!handOnly) await assertNotImported(context.tx, { paymentId: input.paymentId })
      const { payments, notifications } = await storeRegistries(context.tx, context.scope.storeId)
      try {
        // The service writes `refund.created` (the shopper's message, credit notes) itself.
        const r = await refundOrderPayment(
          context.tx,
          context.scope.storeId,
          payments,
          settingsSecret(),
          { ...input, createdBy: context.session.user.email },
        )
        if (r?.giftCardId) {
          // Store credit: email the new card's code to the shopper.
          const ctx = { storeId: context.scope.storeId, tx: context.tx }
          const channels = await giftCardChannels(ctx, notifications, settingsSecret())
          await deliverGiftCard(ctx, r.giftCardId, { channels, secret: settingsSecret() })
        }
        return r
      } catch (err) {
        if (err instanceof CommerceError)
          throw new ORPCError('BAD_REQUEST', { message: err.message })
        throw err
      }
    }),

  /** "Capture payment" (#150): take the money a manual-capture checkout only authorised. */
  capture: can(permissions.ORDERS_REFUND)
    .input(z.object({ paymentId: z.uuid() }))
    .handler(async ({ context, input }) => {
      const { payments } = await storeRegistries(context.tx, context.scope.storeId)
      try {
        const r = await captureOrderPayment(
          context.tx,
          context.scope.storeId,
          payments,
          settingsSecret(),
          input.paymentId,
        )
        if (!r) throw new ORPCError('NOT_FOUND', { message: 'Payment not found' })
        return { status: r.payment.status }
      } catch (err) {
        if (err instanceof CommerceError)
          throw new ORPCError('BAD_REQUEST', { message: err.message })
        throw err
      }
    }),

  /** Add a staff note to the order's timeline. */
  addNote: can(permissions.ORDERS_WRITE)
    .input(z.object({ orderId: z.uuid(), body: z.string().trim().min(1).max(2000) }))
    .handler(({ context, input }) =>
      addOrderNote(context.tx, context.scope.storeId, {
        ...input,
        author: context.session.user.email,
      }),
    ),

  ...orderListRoutes,
  ...orderMessageRoutes,
  ...draftAndAbandonedRoutes,
  ...orderUndoRoutes,
  ...orderEditRoutes,
  ...orderHoldRoutes,
  ...orderContactRoutes,
}
