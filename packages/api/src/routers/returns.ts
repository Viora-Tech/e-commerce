import { loadEnv } from '@commerce/config'
import { permissions, RETURN_REASONS, RETURN_STATUSES } from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import {
  approveStoreReturn,
  arrangeStoreReturnPickup,
  closeStoreReturn,
  createStoreReturn,
  exchangeStoreReturn,
  listStoreReturns,
  orderReturns,
  receiveStoreReturn,
  refundStoreReturn,
  rejectStoreReturn,
  reshipStoreReturn,
  restockStoreReturn,
  returnDetail,
  setStoreReturnCourierCost,
  storeCreditStoreReturn,
  storeReturnCounts,
  storeReturnPolicy,
  storeRtoSummary,
  updateStoreReturnPolicy,
} from '../services/returns.service'

const secret = () => loadEnv(process.env).SETTINGS_SECRET

const pickup = z.discriminatedUnion('method', [
  z.object({ method: z.literal('courier'), providerId: z.string().min(1).max(60) }),
  z.object({ method: z.literal('customer') }),
  z.object({ method: z.literal('later') }),
])

/**
 * Orders → Returns: customer returns and RTO tasks. Reading is orders.read;
 * deciding and receiving is orders.write; anything that moves money is
 * orders.refund; re-shipping books a courier, so orders.fulfil.
 */
export const returnsRouter = {
  list: can(permissions.ORDERS_READ)
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(25),
        status: z.array(z.enum(RETURN_STATUSES)).max(7).optional(),
        kind: z.enum(['return', 'rto']).optional(),
        search: z.string().trim().max(200).optional(),
      }),
    )
    .handler(({ context, input }) => listStoreReturns(context.tx, context.scope.storeId, input)),

  counts: can(permissions.ORDERS_READ).handler(({ context }) =>
    storeReturnCounts(context.tx, context.scope.storeId),
  ),

  get: can(permissions.ORDERS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return returnDetail(context.tx, context.scope.storeId, shipping, secret(), input.id)
    }),

  /** The order page's Returns card: what can still go back and every return so far. */
  forOrder: can(permissions.ORDERS_READ)
    .input(z.object({ orderId: z.uuid() }))
    .handler(({ context, input }) =>
      orderReturns(context.tx, context.scope.storeId, input.orderId),
    ),

  /** Open a return on the shopper's behalf. Not held to the window; never more than shipped. */
  create: can(permissions.ORDERS_WRITE)
    .input(
      z.object({
        orderId: z.uuid(),
        lines: z
          .array(z.object({ orderLineId: z.uuid(), quantity: z.number().int().min(1).max(999) }))
          .min(1)
          .max(100),
        reason: z.enum(RETURN_REASONS),
        note: z.string().trim().max(1000).optional(),
      }),
    )
    .handler(({ context, input }) => createStoreReturn(context.tx, context.scope.storeId, input)),

  approve: can(permissions.ORDERS_WRITE)
    .input(z.object({ id: z.uuid(), pickup }))
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return approveStoreReturn(
        context.tx,
        context.scope.storeId,
        shipping,
        secret(),
        input.id,
        input.pickup,
      )
    }),

  arrangePickup: can(permissions.ORDERS_FULFIL)
    .input(z.object({ id: z.uuid(), pickup }))
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return arrangeStoreReturnPickup(
        context.tx,
        context.scope.storeId,
        shipping,
        secret(),
        input.id,
        input.pickup,
      )
    }),

  reject: can(permissions.ORDERS_WRITE)
    .input(z.object({ id: z.uuid(), note: z.string().trim().min(1).max(1000) }))
    .handler(({ context, input }) =>
      rejectStoreReturn(context.tx, context.scope.storeId, input.id, input.note),
    ),

  receive: can(permissions.ORDERS_WRITE)
    .input(
      z.object({
        id: z.uuid(),
        condition: z.enum(['good', 'damaged', 'used']),
        note: z.string().trim().max(1000).optional(),
        restock: z.boolean().optional(),
      }),
    )
    .handler(({ context, input }) =>
      receiveStoreReturn(context.tx, context.scope.storeId, input.id, input),
    ),

  restock: can(permissions.ORDERS_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) =>
      restockStoreReturn(context.tx, context.scope.storeId, input.id),
    ),

  close: can(permissions.ORDERS_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => closeStoreReturn(context.tx, context.scope.storeId, input.id)),

  refund: can(permissions.ORDERS_REFUND)
    .input(z.object({ id: z.uuid(), amountPaise: z.number().int().positive() }))
    .handler(async ({ context, input }) => {
      const { payments } = await storeRegistries(context.tx, context.scope.storeId)
      return refundStoreReturn(
        context.tx,
        context.scope.storeId,
        payments,
        secret(),
        input.id,
        input.amountPaise,
      )
    }),

  storeCredit: can(permissions.ORDERS_REFUND)
    .input(z.object({ id: z.uuid(), amountPaise: z.number().int().positive() }))
    .handler(async ({ context, input }) => {
      const { notifications } = await storeRegistries(context.tx, context.scope.storeId)
      return storeCreditStoreReturn(
        context.tx,
        context.scope.storeId,
        notifications,
        secret(),
        input.id,
        input.amountPaise,
        context.session.user.email,
      )
    }),

  exchange: can(permissions.ORDERS_WRITE)
    .input(
      z.object({
        id: z.uuid(),
        lines: z
          .array(z.object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(999) }))
          .max(100)
          .optional(),
      }),
    )
    .handler(({ context, input }) => {
      if (!context.scope.can(permissions.DRAFTS_WRITE)) {
        throw new ORPCError('FORBIDDEN', {
          message: 'Your role does not allow creating draft orders',
          data: { required: permissions.DRAFTS_WRITE, role: context.scope.roleSlug },
        })
      }
      return exchangeStoreReturn(context.tx, context.scope.storeId, input.id, input.lines)
    }),

  reship: can(permissions.ORDERS_FULFIL)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const { shipping } = await storeRegistries(context.tx, context.scope.storeId)
      return reshipStoreReturn(context.tx, context.scope.storeId, shipping, secret(), input.id)
    }),

  setCourierCost: can(permissions.ORDERS_WRITE)
    .input(z.object({ id: z.uuid(), paise: z.number().int().min(0).max(10_000_000).nullable() }))
    .handler(({ context, input }) =>
      setStoreReturnCourierCost(context.tx, context.scope.storeId, input.id, input.paise),
    ),

  /** Shipments workspace: RTO counts and costs over the last N days. */
  rtoSummary: can(permissions.ORDERS_READ)
    .input(z.object({ sinceDays: z.number().int().min(1).max(365).default(30) }))
    .handler(({ context, input }) =>
      storeRtoSummary(context.tx, context.scope.storeId, input.sinceDays),
    ),

  policy: can(permissions.SETTINGS_READ).handler(({ context }) =>
    storeReturnPolicy(context.tx, context.scope.storeId),
  ),

  savePolicy: can(permissions.SETTINGS_MANAGE)
    .input(
      z.object({
        enabled: z.boolean(),
        windowDays: z.number().int().min(1).max(90),
        reasons: z.array(z.enum(RETURN_REASONS)).min(1),
        restockAutomatically: z.boolean(),
        refundMethod: z.enum(['original', 'store_credit']),
      }),
    )
    .handler(({ context, input }) =>
      updateStoreReturnPolicy(context.tx, context.scope.storeId, input),
    ),
}
