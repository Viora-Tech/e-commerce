import { loadEnv, settingsSecret } from '@commerce/config'
import {
  CommerceError,
  DraftInputSchema,
  InvalidOrderContact,
  insertOutboxEvent,
  isIsoDay,
  MANUAL_PAYMENT_METHODS,
  ORDER_FULFILLMENT_STATUSES,
  ORDER_MARKS,
  ORDER_PAYMENT_STATUSES,
  OrderNotFound,
  permissions,
  ReminderTooSoon,
  requestBalance,
  sendManualPaymentReminder,
  updateOrderContact,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can, PAGE_SIZE_MAX, SEARCH_MAX } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import {
  convertStoreDraft,
  draftTiles,
  getDraft,
  listStoreAbandoned,
  listStoreDrafts,
  recordInvoiceSent,
  removeDraft,
  saveDraft,
  sendRecovery,
  storeAbandonedStats,
} from '../services/draft.service'
import {
  addOrderNote,
  getOrder,
  importedSource,
  listOrders,
  ORDER_VIEWS,
  orderStats,
  orderTiles,
  refundOrderPayment,
  setOrderStatus,
  setOrderTags,
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
  bookShipment,
  cancelStoreShipment,
  getShipmentForOrder,
  refreshShipmentTracking,
} from '../services/shipping.service'

const storefrontUrl = () => loadEnv(process.env).STOREFRONT_URL

/** What "Mark as" on the order page records; the statuses are then derived. */
const change = z.enum(ORDER_MARKS)

/** Imported historical orders are read-only; every state-changing route refuses them. */
async function assertNotImported(
  tx: Parameters<typeof importedSource>[0],
  ref: Parameters<typeof importedSource>[1],
) {
  const source = await importedSource(tx, ref)
  if (source) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'This order was imported and is read-only. Notes and tags can still be changed.',
    })
  }
}

export const ordersRouter = {
  list: can(permissions.ORDERS_READ)
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
        search: z.string().trim().max(SEARCH_MAX).optional(),
        /** The list tab. */
        view: z.enum(ORDER_VIEWS).optional(),
        status: z.enum(['open', 'completed', 'cancelled']).optional(),
        paymentStatus: z.array(z.enum(ORDER_PAYMENT_STATUSES)).max(10).optional(),
        fulfillmentStatus: z.array(z.enum(ORDER_FULFILLMENT_STATUSES)).max(10).optional(),
      }),
    )
    .handler(({ context, input }) => listOrders(context.tx, input)),

  stats: can(permissions.ORDERS_READ).handler(({ context }) => orderStats(context.tx)),

  tiles: can(permissions.ORDERS_READ).handler(({ context }) => orderTiles(context.tx)),

  get: can(permissions.ORDERS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const o = await getOrder(context.tx, input.id)
      if (!o) return null
      const [shipment, balance, customerOrders, customerOrderNumber] = await Promise.all([
        getShipmentForOrder(context.tx, input.id),
        orderBalance(context.tx, context.scope.storeId, input.id, o.totalPaise),
        customerOrderCount(context.tx, o.customerId),
        customerOrderIndex(context.tx, o.customerId, o.placedAt),
      ])
      return { ...o, shipment, balance, customerOrders, customerOrderNumber }
    }),

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
        trackingNumber: z.string().trim().max(60).optional(),
        // Shown as a link to the shopper and in emails: web links only, never javascript: or data:.
        trackingUrl: z
          .url({ protocol: /^https?$/ })
          .max(500)
          .optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await assertNotImported(context.tx, { orderId: input.orderId })
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
      const { order: o } = await collectOrderPayment(context.tx, context.scope.storeId, {
        ...rest,
        collected,
      }).catch((err) => {
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

  /**
   * "Edit" on the order page's customer card: this order's contact and shipping
   * address, optionally copied to the customer's saved address. Logged on the timeline.
   */
  updateContact: can(permissions.ORDERS_WRITE)
    .input(
      z.object({
        orderId: z.uuid(),
        name: z.string().trim().max(120),
        email: z.email().max(200).nullable(),
        phone: z.string().trim().max(30).nullable(),
        address: z
          .object({
            line1: z.string().trim().max(200),
            line2: z.string().trim().max(200).nullable().optional(),
            city: z.string().trim().max(80),
            stateCode: z.string().trim().max(2),
            pincode: z.string().trim().max(6),
          })
          .nullable(),
        alsoUpdateCustomer: z.boolean().default(false),
      }),
    )
    .handler(async ({ context, input }) => {
      // Rewriting the customer's saved address is a customer edit, not an order edit.
      if (input.alsoUpdateCustomer && !context.scope.can(permissions.CUSTOMERS_WRITE)) {
        throw new ORPCError('FORBIDDEN', { message: 'Your role does not allow write customers' })
      }
      await assertNotImported(context.tx, { orderId: input.orderId })
      try {
        return await updateOrderContact(
          { storeId: context.scope.storeId, tx: context.tx },
          { ...input, author: context.session.user.email },
        )
      } catch (err) {
        if (err instanceof OrderNotFound) {
          throw new ORPCError('NOT_FOUND', { message: 'Order not found' })
        }
        if (err instanceof InvalidOrderContact) {
          throw new ORPCError('BAD_REQUEST', { message: err.message, data: { errors: err.errors } })
        }
        throw err
      }
    }),

  /**
   * Ask the shopper for a deposit pre-order's balance: email and WhatsApp
   * (when set up) with a signed pay link. Can be sent again; reminders and
   * the store's unpaid-balance rule count from the first request.
   */
  requestBalance: can(permissions.ORDERS_WRITE)
    .input(z.object({ orderId: z.uuid() }))
    .handler(async ({ context, input }) => {
      await assertNotImported(context.tx, { orderId: input.orderId })
      try {
        return await requestBalance(
          { storeId: context.scope.storeId, tx: context.tx },
          input.orderId,
          { author: context.session.user.email },
        )
      } catch (err) {
        if (err instanceof CommerceError) {
          throw new ORPCError('BAD_REQUEST', { message: err.message })
        }
        throw err
      }
    }),

  /**
   * "Send payment reminder" on an unpaid UPI / bank transfer order: email, and
   * WhatsApp when set up, with the QR and bank details. At most once every 6 hours.
   */
  sendPaymentReminder: can(permissions.ORDERS_WRITE)
    .input(z.object({ orderId: z.uuid() }))
    .handler(async ({ context, input }) => {
      await assertNotImported(context.tx, { orderId: input.orderId })
      try {
        return await sendManualPaymentReminder(
          { storeId: context.scope.storeId, tx: context.tx },
          input.orderId,
          { author: context.session.user.email },
        )
      } catch (err) {
        if (err instanceof ReminderTooSoon) {
          throw new ORPCError('TOO_MANY_REQUESTS', {
            message: err.message,
            data: { nextAt: err.nextAt.toISOString() },
          })
        }
        if (err instanceof CommerceError) {
          throw new ORPCError('BAD_REQUEST', { message: err.message })
        }
        throw err
      }
    }),

  /** Book the parcel with the store's courier; the order becomes fulfilled and the shopper is told. */
  createShipment: can(permissions.ORDERS_FULFIL)
    .input(z.object({ orderId: z.uuid() }))
    .handler(async ({ context, input }) => {
      await assertNotImported(context.tx, { orderId: input.orderId })
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      // Booking packs what is left; the recompute writes order.fulfilled only
      // if this is what completed the packing.
      return bookShipment(
        context.tx,
        context.scope.storeId,
        shipping,
        settingsSecret(),
        input.orderId,
      )
    }),

  refreshTracking: can(permissions.ORDERS_READ)
    .input(z.object({ shipmentId: z.uuid() }))
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return refreshShipmentTracking(
        context.tx,
        context.scope.storeId,
        shipping,
        settingsSecret(),
        input.shipmentId,
      )
    }),

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
      )
    }),

  /** "Mark as paid / fulfilled / delivered", or cancel. Events follow the derived transitions. */
  setStatus: can(permissions.ORDERS_WRITE)
    .input(z.object({ id: z.uuid(), status: change }))
    .handler(async ({ context, input }) => {
      // Cancelling is its own grant; everything else on this route is orders.write.
      if (input.status === 'cancelled' && !context.scope.can(permissions.ORDERS_CANCEL)) {
        throw new ORPCError('FORBIDDEN', {
          message: 'Your role does not allow cancelling orders',
          data: { required: permissions.ORDERS_CANCEL, role: context.scope.roleSlug },
        })
      }
      await assertNotImported(context.tx, { orderId: input.id })
      const o = await setOrderStatus(
        context.tx,
        context.scope.storeId,
        input.id,
        input.status,
      ).catch((err) => {
        if (err instanceof CommerceError) {
          throw new ORPCError('BAD_REQUEST', { message: err.message })
        }
        throw err
      })
      return o
    }),

  /** Send money back through the gateway (or record a cash/UPI refund); partial amounts allowed. */
  refund: can(permissions.ORDERS_REFUND)
    .input(
      z.object({
        paymentId: z.uuid(),
        amountPaise: z.number().int().positive(),
        reason: z.string().trim().max(500).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await assertNotImported(context.tx, { paymentId: input.paymentId })
      const { payments } = await storeRegistries(context.tx, context.scope.storeId)
      try {
        const r = await refundOrderPayment(
          context.tx,
          context.scope.storeId,
          payments,
          settingsSecret(),
          input,
        )
        // Failed gateway refunds returned no money, so there is nothing to credit.
        if (r && r.status !== 'failed') {
          await insertOutboxEvent(context.tx, context.scope.storeId, 'refund.created', {
            orderId: r.orderId,
            refundId: r.id,
          })
        }
        return r
      } catch (err) {
        if (err instanceof CommerceError)
          throw new ORPCError('BAD_REQUEST', { message: err.message })
        throw err
      }
    }),

  addNote: can(permissions.ORDERS_WRITE)
    .input(z.object({ orderId: z.uuid(), body: z.string().trim().min(1).max(2000) }))
    .handler(({ context, input }) =>
      addOrderNote(context.tx, context.scope.storeId, {
        ...input,
        author: context.session.user.email,
      }),
    ),

  setTags: can(permissions.ORDERS_WRITE)
    .input(z.object({ id: z.uuid(), tags: z.array(z.string().trim().min(1).max(40)).max(20) }))
    .handler(({ context, input }) => setOrderTags(context.tx, input.id, input.tags)),

  /* Draft orders: built by hand in admin, invisible to the storefront until converted. */

  listDrafts: can(permissions.DRAFTS_READ)
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
        search: z.string().trim().max(SEARCH_MAX).optional(),
      }),
    )
    .handler(({ context, input }) => listStoreDrafts(context.tx, context.scope.storeId, input)),

  draftTiles: can(permissions.DRAFTS_READ).handler(({ context }) => draftTiles(context.tx)),

  getDraft: can(permissions.DRAFTS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => getDraft(context.tx, input.id)),

  saveDraft: can(permissions.DRAFTS_WRITE)
    .input(z.object({ id: z.uuid().optional(), draft: DraftInputSchema }))
    .handler(({ context, input }) => saveDraft(context.tx, context.scope.storeId, input)),

  deleteDraft: can(permissions.DRAFTS_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => removeDraft(context.tx, context.scope.storeId, input.id)),

  /** Email the shopper a pay link for the draft. */
  sendInvoice: can(permissions.DRAFTS_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const draft = await getDraft(context.tx, input.id)
      if (!draft) throw new ORPCError('NOT_FOUND', { message: 'Draft not found' })
      if (!draft.email) {
        throw new ORPCError('BAD_REQUEST', { message: 'Add an email address first' })
      }
      await recordInvoiceSent(context.tx, context.scope.storeId, input.id, draft.email)
      await insertOutboxEvent(context.tx, context.scope.storeId, 'draft.invoice_sent', {
        orderId: input.id,
      })
      return { sentTo: draft.email }
    }),

  convertDraft: can(permissions.DRAFTS_WRITE)
    .input(z.object({ id: z.uuid(), paymentMethod: z.string().trim().max(60).optional() }))
    .handler(async ({ context, input }) => {
      const row = await convertStoreDraft(context.tx, context.scope.storeId, input)
      await insertOutboxEvent(context.tx, context.scope.storeId, 'order.placed', {
        orderId: input.id,
      })
      return row
    }),

  /* Abandoned checkouts: carts that captured a contact and went quiet. */

  listAbandoned: can(permissions.ORDERS_READ)
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
        sinceDays: z.number().int().min(1).max(90).default(30),
      }),
    )
    .handler(({ context, input }) => listStoreAbandoned(context.tx, context.scope.storeId, input)),

  abandonedStats: can(permissions.ORDERS_READ).handler(({ context }) =>
    storeAbandonedStats(context.tx, context.scope.storeId),
  ),

  sendRecovery: can(permissions.ORDERS_WRITE)
    .input(z.object({ cartId: z.uuid() }))
    .handler(async ({ context, input }) => {
      const { notifications } = await storeRegistries(context.tx, context.scope.storeId)
      return sendRecovery(context.tx, context.scope.storeId, {
        cartId: input.cartId,
        registry: notifications,
        settingsSecret: settingsSecret(),
        storefrontUrl: storefrontUrl(),
      })
    }),
}
