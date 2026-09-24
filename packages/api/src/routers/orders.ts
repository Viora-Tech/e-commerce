import { loadEnv } from '@commerce/config'
import {
  CommerceError,
  DraftInputSchema,
  insertOutboxEvent,
  type OutboxEventType,
  permissions,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import {
  convertStoreDraft,
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
  orderStats,
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

const secret = () => loadEnv(process.env).SETTINGS_SECRET
const storefrontUrl = () => loadEnv(process.env).STOREFRONT_URL

const status = z.enum(['placed', 'paid', 'fulfilled', 'delivered', 'cancelled'])

/** Which outbox event a merchant-driven status change writes. */
const STATUS_EVENT: Partial<Record<z.infer<typeof status>, OutboxEventType>> = {
  paid: 'order.paid',
  fulfilled: 'order.fulfilled',
}

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
        perPage: z.number().int().min(1).max(100).default(25),
        search: z.string().trim().max(200).optional(),
        status: status.optional(),
      }),
    )
    .handler(({ context, input }) => listOrders(context.tx, input)),

  stats: can(permissions.ORDERS_READ).handler(({ context }) => orderStats(context.tx)),

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
        trackingUrl: z.url().max(500).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await assertNotImported(context.tx, { orderId: input.orderId })
      try {
        const result = await fulfilOrder(context.tx, context.scope.storeId, input)
        if (result.complete) {
          await insertOutboxEvent(context.tx, context.scope.storeId, 'order.fulfilled', {
            orderId: input.orderId,
          })
        }
        return result
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
        method: z.string().trim().max(40).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await assertNotImported(context.tx, { orderId: input.orderId })
      const o = await collectOrderPayment(context.tx, context.scope.storeId, input)
      if (o) {
        await insertOutboxEvent(context.tx, context.scope.storeId, 'order.paid', { orderId: o.id })
      }
      return o
    }),

  /** Book the parcel with the store's courier; the order becomes fulfilled and the shopper is told. */
  createShipment: can(permissions.ORDERS_FULFIL)
    .input(z.object({ orderId: z.uuid() }))
    .handler(async ({ context, input }) => {
      await assertNotImported(context.tx, { orderId: input.orderId })
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      const row = await bookShipment(
        context.tx,
        context.scope.storeId,
        shipping,
        secret(),
        input.orderId,
      )
      await insertOutboxEvent(context.tx, context.scope.storeId, 'order.fulfilled', {
        orderId: input.orderId,
      })
      return row
    }),

  refreshTracking: can(permissions.ORDERS_READ)
    .input(z.object({ shipmentId: z.uuid() }))
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return refreshShipmentTracking(
        context.tx,
        context.scope.storeId,
        shipping,
        secret(),
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
        secret(),
        input.shipmentId,
      )
    }),

  setStatus: can(permissions.ORDERS_WRITE)
    .input(z.object({ id: z.uuid(), status }))
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
      const event = STATUS_EVENT[input.status]
      if (o && event) {
        await insertOutboxEvent(context.tx, context.scope.storeId, event, { orderId: o.id })
      }
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
          secret(),
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
        perPage: z.number().int().min(1).max(100).default(25),
        search: z.string().trim().max(200).optional(),
      }),
    )
    .handler(({ context, input }) => listStoreDrafts(context.tx, context.scope.storeId, input)),

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
        perPage: z.number().int().min(1).max(100).default(25),
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
        settingsSecret: secret(),
        storefrontUrl: storefrontUrl(),
      })
    }),
}
