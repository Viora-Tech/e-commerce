import { loadEnv } from '@commerce/config'
import {
  CommerceError,
  DraftInputSchema,
  enqueueNotification,
  type TemplateId,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { storeProcedure } from '../procedures'
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
  listOrders,
  orderStats,
  refundOrderPayment,
  setOrderStatus,
  setOrderTags,
} from '../services/order.service'
import {
  bookShipment,
  cancelStoreShipment,
  getShipmentForOrder,
  refreshShipmentTracking,
} from '../services/shipping.service'

const secret = () => loadEnv(process.env).SETTINGS_SECRET
const storefrontUrl = () => loadEnv(process.env).STOREFRONT_URL

const status = z.enum(['placed', 'paid', 'fulfilled', 'delivered', 'cancelled'])

/** Which shopper message a merchant-driven status change triggers. */
const STATUS_TEMPLATE: Partial<Record<z.infer<typeof status>, TemplateId>> = {
  paid: 'payment_received',
  fulfilled: 'order_shipped',
}

export const ordersRouter = {
  list: storeProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(25),
        search: z.string().trim().max(200).optional(),
        status: status.optional(),
      }),
    )
    .handler(({ context, input }) => listOrders(context.tx, input)),

  stats: storeProcedure.handler(({ context }) => orderStats(context.tx)),

  get: storeProcedure.input(z.object({ id: z.uuid() })).handler(async ({ context, input }) => {
    const o = await getOrder(context.tx, input.id)
    if (!o) return null
    return { ...o, shipment: await getShipmentForOrder(context.tx, input.id) }
  }),

  /** Book the parcel with the store's courier; the order becomes fulfilled and the shopper is told. */
  createShipment: storeProcedure
    .input(z.object({ orderId: z.uuid() }))
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      const row = await bookShipment(
        context.tx,
        context.scope.storeId,
        shipping,
        secret(),
        input.orderId,
      )
      await enqueueNotification(context.notifications, {
        storeId: context.scope.storeId,
        orderId: input.orderId,
        template: 'order_shipped',
      })
      return row
    }),

  refreshTracking: storeProcedure
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

  cancelShipment: storeProcedure
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

  setStatus: storeProcedure
    .input(z.object({ id: z.uuid(), status }))
    .handler(async ({ context, input }) => {
      const o = await setOrderStatus(context.tx, input.id, input.status)
      const template = STATUS_TEMPLATE[input.status]
      if (o && template) {
        await enqueueNotification(context.notifications, {
          storeId: context.scope.storeId,
          orderId: o.id,
          template,
        })
      }
      return o
    }),

  /** Send money back through the gateway (or record a cash/UPI refund); partial amounts allowed. */
  refund: storeProcedure
    .input(
      z.object({
        paymentId: z.uuid(),
        amountPaise: z.number().int().positive(),
        reason: z.string().trim().max(500).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { payments } = await storeRegistries(context.tx, context.scope.storeId)
      try {
        return await refundOrderPayment(
          context.tx,
          context.scope.storeId,
          payments,
          secret(),
          input,
        )
      } catch (err) {
        if (err instanceof CommerceError)
          throw new ORPCError('BAD_REQUEST', { message: err.message })
        throw err
      }
    }),

  addNote: storeProcedure
    .input(z.object({ orderId: z.uuid(), body: z.string().trim().min(1).max(2000) }))
    .handler(({ context, input }) =>
      addOrderNote(context.tx, context.scope.storeId, {
        ...input,
        author: context.session.user.email,
      }),
    ),

  setTags: storeProcedure
    .input(z.object({ id: z.uuid(), tags: z.array(z.string().trim().min(1).max(40)).max(20) }))
    .handler(({ context, input }) => setOrderTags(context.tx, input.id, input.tags)),

  /* Draft orders: built by hand in admin, invisible to the storefront until converted. */

  listDrafts: storeProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(25),
        search: z.string().trim().max(200).optional(),
      }),
    )
    .handler(({ context, input }) => listStoreDrafts(context.tx, context.scope.storeId, input)),

  getDraft: storeProcedure
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => getDraft(context.tx, input.id)),

  saveDraft: storeProcedure
    .input(z.object({ id: z.uuid().optional(), draft: DraftInputSchema }))
    .handler(({ context, input }) => saveDraft(context.tx, context.scope.storeId, input)),

  deleteDraft: storeProcedure
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => removeDraft(context.tx, context.scope.storeId, input.id)),

  /** Email the shopper a pay link for the draft. */
  sendInvoice: storeProcedure
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const draft = await getDraft(context.tx, input.id)
      if (!draft) throw new ORPCError('NOT_FOUND', { message: 'Draft not found' })
      if (!draft.email) {
        throw new ORPCError('BAD_REQUEST', { message: 'Add an email address first' })
      }
      await recordInvoiceSent(context.tx, context.scope.storeId, input.id, draft.email)
      await enqueueNotification(context.notifications, {
        storeId: context.scope.storeId,
        orderId: input.id,
        template: 'draft_invoice',
      })
      return { sentTo: draft.email }
    }),

  convertDraft: storeProcedure
    .input(z.object({ id: z.uuid(), paymentMethod: z.string().trim().max(60).optional() }))
    .handler(async ({ context, input }) => {
      const row = await convertStoreDraft(context.tx, context.scope.storeId, input)
      await enqueueNotification(context.notifications, {
        storeId: context.scope.storeId,
        orderId: input.id,
        template: 'order_placed',
      })
      return row
    }),

  /* Abandoned checkouts: carts that captured a contact and went quiet. */

  listAbandoned: storeProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(25),
        sinceDays: z.number().int().min(1).max(90).default(30),
      }),
    )
    .handler(({ context, input }) => listStoreAbandoned(context.tx, context.scope.storeId, input)),

  abandonedStats: storeProcedure.handler(({ context }) =>
    storeAbandonedStats(context.tx, context.scope.storeId),
  ),

  sendRecovery: storeProcedure
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
