import {
  CodRtoSettingsSchema,
  codRtoOverview,
  codRtoState,
  listRiskOrders,
  markCodConfirmed,
  orderCodRto,
  permissions,
  RISK_ORDER_FILTERS,
  rescoreOrder,
  scoreOpenOrders,
  returnReasonsReport,
  saveCodRtoSettings,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can, PAGE_MAX, PAGE_SIZE_MAX } from '../procedures'

type Ctx = { tx: StoreTx; scope: { storeId: string } }

/** Report windows the pages offer, in days. */
const PERIODS = [7, 30, 90] as const

const period = z
  .number()
  .int()
  .refine((d) => (PERIODS as readonly number[]).includes(d))
  .default(30)

async function requireInstalled(context: Ctx) {
  const { installed, settings } = await codRtoState(context.tx, context.scope.storeId)
  if (!installed) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the COD & RTO app first' })
  }
  return settings
}

const ctxOf = (context: Ctx) => ({ storeId: context.scope.storeId, tx: context.tx })

/**
 * The COD & RTO app's admin pages and its order card. Reading is orders.read; scoring again
 * and marking a COD order confirmed is orders.write; the settings are settings.manage.
 */
export const codRtoRouter = {
  overview: can(permissions.ORDERS_READ)
    .input(z.object({ days: period }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return codRtoOverview(ctxOf(context), input.days)
    }),

  orders: can(permissions.ORDERS_READ)
    .input(
      z.object({
        filter: z.enum(RISK_ORDER_FILTERS).default('risky'),
        openOnly: z.boolean().default(true),
        page: z.number().int().min(1).max(PAGE_MAX).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return listRiskOrders(ctxOf(context), input)
    }),

  returnReasons: can(permissions.ORDERS_READ)
    .input(z.object({ days: period }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return returnReasonsReport(ctxOf(context), input.days)
    }),

  /** The order page's card. */
  forOrder: can(permissions.ORDERS_READ)
    .input(z.object({ orderId: z.uuid() }))
    .handler(async ({ context, input }) => {
      const settings = await requireInstalled(context)
      const row = await orderCodRto(ctxOf(context), input.orderId)
      return row ? { ...row, thresholds: settings.risk } : null
    }),

  rescore: can(permissions.ORDERS_WRITE)
    .input(z.object({ orderId: z.uuid() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return rescoreOrder(ctxOf(context), input.orderId)
    }),

  /** "Score open orders": open orders with no score (imported ones), up to a batch per press. */
  scoreOpen: can(permissions.ORDERS_WRITE).handler(async ({ context }) => {
    await requireInstalled(context)
    return scoreOpenOrders(ctxOf(context))
  }),

  /** "Confirmed by phone": the merchant called the shopper. */
  markConfirmed: can(permissions.ORDERS_WRITE)
    .input(z.object({ orderId: z.uuid() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return markCodConfirmed(ctxOf(context), input.orderId, context.session.user.email)
    }),

  settings: {
    get: can(permissions.SETTINGS_READ).handler(({ context }) => requireInstalled(context)),
    save: can(permissions.SETTINGS_MANAGE)
      .input(CodRtoSettingsSchema)
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        return saveCodRtoSettings(context.tx, context.scope.storeId, input)
      }),
  },
}
