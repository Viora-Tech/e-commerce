import { loadEnv } from '@commerce/config'
import {
  AppNotForSale,
  AutopayError,
  autopayConfig,
  BillingNotReady,
  buyAiCredits,
  buyApp,
  cancelAutopay,
  choosePlan,
  ensureStorePlan,
  keepCurrentPlan,
  listAppBills,
  loadAutopay,
  loadPlanView,
  PLAN_IDS,
  PLANS,
  permissions,
  planUsage,
  resolveBillingEnv,
  startAutopay,
  stopAppRenewal,
  storeAppAccess,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import type { ApiContext } from '../context'
import { can } from '../procedures'

const env = () => loadEnv(process.env)

const billingEnv = (context: ApiContext) =>
  resolveBillingEnv(context.db, {
    salesStoreId: env().PLATFORM_SALES_STORE_ID,
    settingsSecret: env().SETTINGS_SECRET,
    storefrontUrl: env().STOREFRONT_URL,
  })

const NOT_READY: Record<BillingNotReady['reason'], string> = {
  no_sales_store: 'Paying for plans is not switched on yet. We will let you know when it is.',
  no_plan_product: 'This plan is not on sale yet. Please contact us to change plans.',
  no_gateway: 'Payments for plans are not set up yet. Please contact us.',
}

export const billingRouter = {
  /** UPI AutoPay: whether it can be turned on here, and the store's mandate. */
  autopay: can(permissions.SETTINGS_READ).handler(async ({ context }) => ({
    available: autopayConfig(process.env) !== null,
    mandate: await loadAutopay(context.db, context.scope.storeId),
  })),

  /** "Turn on UPI AutoPay" for the current plan: the page where the owner approves the mandate. */
  startAutopay: can(permissions.BILLING_MANAGE).handler(async ({ context }) => {
    const cfg = autopayConfig(process.env)
    if (!cfg)
      throw new ORPCError('PRECONDITION_FAILED', { message: 'UPI AutoPay is not switched on yet.' })
    const view = await loadPlanView(context.tx, context.scope.storeId, await billingEnv(context))
    try {
      return await startAutopay(
        context.db,
        context.scope.storeId,
        { plan: view.nextPlan ?? view.plan, interval: view.interval },
        cfg,
      )
    } catch (err) {
      if (err instanceof AutopayError) throw new ORPCError('BAD_GATEWAY', { message: err.message })
      throw err
    }
  }),

  /** "Turn off AutoPay": renewals go back to pay links. */
  cancelAutopay: can(permissions.BILLING_MANAGE).handler(async ({ context }) => {
    const cfg = autopayConfig(process.env)
    if (cfg) await cancelAutopay(context.db, context.scope.storeId, cfg)
    return { ok: true }
  }),

  /** Paid apps: what each one costs on this plan, bought months, and the store's app bills. */
  apps: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const env = await billingEnv(context)
    const [access, bills] = await Promise.all([
      storeAppAccess(context.tx, context.scope.storeId),
      listAppBills(context.tx, context.scope.storeId, env),
    ])
    return { access, bills }
  }),

  /** "Buy" on a paid app: the pay link for its first month; paying installs it. */
  buyApp: can(permissions.BILLING_MANAGE)
    .input(z.object({ pluginId: z.string().min(1).max(80) }))
    .handler(async ({ context, input }) => {
      try {
        return await buyApp(
          context.db,
          context.scope.storeId,
          input.pluginId,
          await billingEnv(context),
        )
      } catch (err) {
        if (err instanceof AppNotForSale)
          throw new ORPCError('CONFLICT', { message: 'Your plan already includes this app.' })
        if (err instanceof BillingNotReady)
          throw new ORPCError('PRECONDITION_FAILED', { message: NOT_READY[err.reason] })
        throw err
      }
    }),

  /** Settings → AI → "Buy 1,000 credits": the pay link; paying adds the credits. */
  buyCredits: can(permissions.BILLING_MANAGE).handler(async ({ context }) => {
    try {
      return await buyAiCredits(context.db, context.scope.storeId, await billingEnv(context))
    } catch (err) {
      if (err instanceof BillingNotReady)
        throw new ORPCError('PRECONDITION_FAILED', { message: NOT_READY[err.reason] })
      throw err
    }
  }),

  /** "Stop renewing": the app keeps working until its paid month ends. */
  stopApp: can(permissions.BILLING_MANAGE)
    .input(z.object({ pluginId: z.string().min(1).max(80) }))
    .handler(async ({ context, input }) => {
      await stopAppRenewal(context.tx, context.scope.storeId, input.pluginId)
      return { ok: true }
    }),

  /** Settings → Plan & billing: the plan, this month's usage, bills and the one due. */
  view: can(permissions.SETTINGS_READ).handler(async ({ context }) =>
    loadPlanView(context.tx, context.scope.storeId, await billingEnv(context)),
  ),

  /** The sidebar's "Orders this month · 142 of 200": cheap, on every page. */
  usage: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const row = await ensureStorePlan(context.tx, context.scope.storeId)
    const usage = await planUsage(context.tx)
    return { plan: row.plan, status: row.status, used: usage.orders, limit: PLANS[row.plan].orders }
  }),

  /** Pick a plan: billed now (pay link) or, for a downgrade, scheduled for the period end. */
  choose: can(permissions.BILLING_MANAGE)
    .input(z.object({ plan: z.enum(PLAN_IDS), interval: z.enum(['month', 'year']) }))
    .handler(async ({ context, input }) => {
      try {
        return await choosePlan(context.db, context.scope.storeId, input, await billingEnv(context))
      } catch (err) {
        if (err instanceof BillingNotReady) {
          throw new ORPCError('PRECONDITION_FAILED', { message: NOT_READY[err.reason] })
        }
        throw err
      }
    }),

  /** Cancel a scheduled downgrade. */
  keepPlan: can(permissions.BILLING_MANAGE).handler(async ({ context }) => {
    await keepCurrentPlan(context.tx, context.scope.storeId)
    return { ok: true }
  }),
}
