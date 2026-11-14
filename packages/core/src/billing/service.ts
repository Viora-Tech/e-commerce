/** SOURCE OF TRUTH: store plans and plan bills — WHAT a store's plan is, what it owes, and how a
 * bill becomes an order on the platform's sales store / WHY payments, GST invoices and receipts
 * already work there (checkout, Razorpay, the GST-invoice app); billing only remembers which
 * order paid for which period. Pay-by-link for now (UPI AutoPay later).
 */

import { siteConfig } from '@commerce/config/site'
import { dayKey } from '@commerce/dates'
import {
  aiSettings,
  type Db,
  order,
  planPayment,
  product,
  type StoreTx,
  store,
  storePlan,
  usageBill,
  variant,
  withStore,
} from '@commerce/db'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { storefrontOriginFor } from '../domains/origin'
import { CommerceError } from '../errors'
import { convertDraft, createDraft } from '../order/drafts'
import { cancelOrder } from '../order/status'
import { createPaymentAttempt } from '../payments/attempts'
import { isGatewayProvider } from '../payments/methods'
import { parsePaymentSettings } from '../payments/settings'
import { orderViewToken, thankYouPath } from '../preorder/balance-link'
import { validateGstin } from '../tax/gstin'
import { autopayActive } from './autopay'
import { planBillWhat, sendPlanBillEmail } from './emails'
import { type MonthPace, monthPace, type UpgradeNudge, upgradeNudge } from './next-bill'
import { quoteNote } from './plan-change'
import {
  addInterval,
  type BillingInterval,
  GRACE_DAYS,
  PLANS,
  type PlanId,
  planSku,
  RENEW_AHEAD_DAYS,
  TRIAL_DAYS,
} from './plans'
import { type PlanChargeQuote, paidPeriodEnd } from './proration'
import { type PlanUsage, planUsage } from './usage'
import { feeBillChargePaise, withFeeGst } from './usage-fee'
import { billingMonth, feeEstimate, previousMonth } from './usage-fee-service'

const DAY_MS = 86_400_000

export type BillingEnv = {
  /** PLATFORM_SALES_STORE_ID: the store that sells plans; unset means billing is off. */
  salesStoreId: string | undefined
  settingsSecret: string
  /** The sales store's storefront origin, for pay links. */
  salesStorefrontUrl: string | null
}

export class BillingNotReady extends CommerceError {
  constructor(readonly reason: 'no_sales_store' | 'no_plan_product' | 'no_gateway') {
    super('BILLING_NOT_READY', `Billing is not set up: ${reason}`)
  }
}

/** An unlimited store (Koomerce's own) has no plan to pick or bill. */
export class UnlimitedPlan extends CommerceError {
  constructor() {
    super(
      'UNLIMITED_PLAN',
      'This store is on an unlimited plan; there is nothing to choose or pay.',
    )
  }
}

type StorePlanRow = typeof storePlan.$inferSelect
type BillRow = typeof planPayment.$inferSelect

/**
 * The store's plan row, made on first read: a 14-day Growth trial. Read first: the row exists
 * for every store after its first page, and the admin layout asks on every page, so the insert
 * runs only when it is missing.
 */
export async function ensureStorePlan(
  tx: StoreTx,
  storeId: string,
  now = new Date(),
): Promise<StorePlanRow> {
  const [found] = await tx.select().from(storePlan).where(eq(storePlan.storeId, storeId))
  if (found) return found
  await tx
    .insert(storePlan)
    .values({
      storeId,
      plan: 'growth',
      interval: 'month',
      status: 'trialing',
      trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * DAY_MS),
    })
    .onConflictDoNothing({ target: storePlan.storeId })
  const [row] = await tx.select().from(storePlan).where(eq(storePlan.storeId, storeId))
  if (!row) throw new Error(`store_plan missing for ${storeId}`)
  return row
}

export type PlanBill = {
  id: string
  plan: PlanId
  interval: BillingInterval
  number: number
  amountPaise: number
  periodStart: Date
  periodEnd: Date
  status: BillRow['status']
  paidAt: Date | null
  /** The signed order page on the sales store: pay while due, download the invoice once paid. */
  url: string | null
}

export type PlanView = {
  plan: PlanId
  /** Koomerce's own store: no limits, fees or bills; the page shows no plan choice. */
  unlimited: boolean
  interval: BillingInterval
  status: StorePlanRow['status']
  trialEndsAt: Date | null
  periodStart: Date | null
  periodEnd: Date | null
  nextPlan: PlanId | null
  usage: PlanUsage
  bills: PlanBill[]
  due: PlanBill | null
  /** False until the sales store sells plans, so the page can say why paying is off. */
  billingReady: boolean
  /** Where invoices go: the store's contact email. */
  invoiceEmail: string | null
  /** This month's per-order fees so far, and what earlier months carried in. */
  fees: Awaited<ReturnType<typeof feeEstimate>>
  /** The last 12 months of per-order fee bills, newest first. */
  usageBills: UsageBillView[]
  /** Fee bills still waiting for payment, in paise (the banner). */
  unpaidFees: number
  /** Last month closed two months running over the plan's fair-use visits. */
  fairUseNotice: boolean
  /** This month's orders and where they are heading: Change plan's "at your pace" lines. */
  pace: MonthPace
  /** A bigger plan that would cost less at this pace (the "Pro would save about ₹1,100" box). */
  nudge: UpgradeNudge | null
}

export type UsageBillView = {
  id: string
  month: string
  ordersCounted: number
  feeOrders: number
  totalPaise: number
  status: (typeof usageBill.$inferSelect)['status']
  paidAt: Date | null
  /** The signed order page while it has its own order; null when carried or merged. */
  url: string | null
}

/** The signed order page on the sales store: pay while due, the invoice once paid. */
export const salesOrderUrl = (env: BillingEnv, id: string, number: number): string | null =>
  env.salesStorefrontUrl
    ? `${env.salesStorefrontUrl.replace(/\/$/, '')}${thankYouPath(
        number,
        orderViewToken(id, env.settingsSecret),
      )}`
    : null

const billUrl = (env: BillingEnv, b: BillRow): string | null =>
  salesOrderUrl(env, b.salesOrderId, b.salesOrderNumber)

const toBill = (env: BillingEnv, b: BillRow): PlanBill => ({
  id: b.id,
  plan: b.plan,
  interval: b.interval,
  number: b.salesOrderNumber,
  amountPaise: b.amountPaise,
  periodStart: b.periodStart,
  periodEnd: b.periodEnd,
  status: b.status,
  paidAt: b.paidAt,
  url: billUrl(env, b),
})

/** Everything the Plan & billing page shows, for the signed-in store. */
export async function loadPlanView(
  tx: StoreTx,
  storeId: string,
  env: BillingEnv,
  now = new Date(),
): Promise<PlanView> {
  const row = await ensureStorePlan(tx, storeId, now)
  const [usage, bills, [contact], fees, feeBills] = await Promise.all([
    planUsage(tx, now),
    tx
      .select()
      .from(planPayment)
      .where(eq(planPayment.storeId, storeId))
      .orderBy(desc(planPayment.createdAt))
      .limit(24),
    tx.select({ email: store.contactEmail }).from(store).where(eq(store.id, storeId)),
    feeEstimate(tx, storeId, now),
    tx
      .select()
      .from(usageBill)
      // A month with nothing to pay is kept (it closes the month) but not listed.
      .where(
        and(
          eq(usageBill.storeId, storeId),
          sql`not (${usageBill.status} = 'carried' and ${usageBill.totalPaise} = 0)`,
        ),
      )
      .orderBy(desc(usageBill.month))
      .limit(12),
  ])
  const shown = bills.map((b) => toBill(env, b))
  const pace = monthPace(usage.orders, usage.salesPaise, dayKey(now))
  const usageBills = feeBills.map(
    (b): UsageBillView => ({
      id: b.id,
      month: b.month,
      ordersCounted: b.ordersCounted,
      feeOrders: b.feeOrders,
      // What the store pays: the fee with 18% GST on top, as its sales order charges it.
      totalPaise: feeBillChargePaise(b),
      status: b.status,
      paidAt: b.paidAt,
      url:
        b.salesOrderId && b.salesOrderNumber !== null && b.status !== 'merged'
          ? salesOrderUrl(env, b.salesOrderId, b.salesOrderNumber)
          : null,
    }),
  )
  return {
    plan: row.plan,
    unlimited: row.unlimited,
    interval: row.interval,
    status: row.status,
    trialEndsAt: row.trialEndsAt,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    nextPlan: row.nextPlan,
    usage,
    bills: shown,
    due: shown.find((b) => b.status === 'due') ?? null,
    billingReady: Boolean(env.salesStoreId && env.salesStorefrontUrl),
    invoiceEmail: contact?.email ?? null,
    fees,
    usageBills,
    unpaidFees: usageBills.filter((b) => b.status === 'due').reduce((n, b) => n + b.totalPaise, 0),
    fairUseNotice: row.fairUseNoticeMonth === previousMonth(billingMonth(now)),
    pace,
    nudge: row.unlimited ? null : upgradeNudge(row.plan, pace),
  }
}

/** A plan's or app's variant on the sales store, found by SKU (`plan-growth-month`). */
async function variantBySku(tx: StoreTx, sku: string) {
  const [v] = await tx
    .select({ id: variant.id, pricePaise: variant.pricePaise })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(and(eq(variant.sku, sku), eq(product.status, 'active')))
    .limit(1)
  return v ?? null
}

/** The gateway the sales store takes payments with (its first enabled one). */
async function salesGateway(tx: StoreTx, salesStoreId: string): Promise<string | null> {
  const [s] = await tx
    .select({ payments: store.payments })
    .from(store)
    .where(eq(store.id, salesStoreId))
  const enabled = parsePaymentSettings(s?.payments).enabled
  return enabled.find((id) => isGatewayProvider(id)) ?? null
}

/** One line of a sales order: the variant with `sku`, once; `unitPricePaise` sets a computed amount. */
export type SalesLine = { sku: string; unitPricePaise?: number }

/**
 * One bill as an order on the sales store: the variants with each line's `sku`, a draft for
 * the buying store's name and email, converted to an open order with a payment attempt
 * waiting. Plan, app, credit and usage bills all go through here.
 */
export async function placeSalesOrder(
  db: Db,
  env: BillingEnv,
  storeId: string,
  input: { lines: SalesLine[]; note: (buyer: string) => string },
): Promise<{ id: string; number: number; totalPaise: number }> {
  const salesStoreId = env.salesStoreId
  if (!salesStoreId) throw new BillingNotReady('no_sales_store')
  const buyer = await withStore(db, storeId, async (tx) => {
    const [s] = await tx
      .select({ name: store.name, email: store.contactEmail, gstin: store.gstin })
      .from(store)
      .where(eq(store.id, storeId))
    return s
  })
  // A GST-registered store gets a B2B invoice it can claim input credit on.
  const gst = buyer?.gstin ? validateGstin(buyer.gstin) : null
  return withStore(db, salesStoreId, async (tx) => {
    const lines = []
    for (const line of input.lines) {
      const v = await variantBySku(tx, line.sku)
      if (!v) throw new BillingNotReady('no_plan_product')
      lines.push({
        variantId: v.id,
        quantity: 1,
        ...(line.unitPricePaise === undefined ? {} : { unitPricePaise: line.unitPricePaise }),
      })
    }
    const gateway = await salesGateway(tx, salesStoreId)
    if (!gateway) throw new BillingNotReady('no_gateway')
    const ctx = { storeId: salesStoreId, tx }
    const draft = await createDraft(ctx, {
      email: buyer?.email ?? null,
      customerName: buyer?.name ?? null,
      lines,
      discountPaise: 0,
      shippingPaise: 0,
      note: input.note(buyer?.name ?? storeId),
    })
    if (gst?.ok)
      await tx
        .update(order)
        .set({ buyerGstin: gst.gstin, buyerBusinessName: buyer?.name ?? null })
        .where(eq(order.id, draft.id))
    // A plan or app bill ships nothing, so it needs no shipping address.
    const placed = await convertDraft(ctx, draft.id, {
      paymentMethod: gateway,
      requireShippingAddress: false,
    })
    if (!placed) throw new Error(`sales order ${draft.id} could not be placed`)
    const [o] = await tx
      .select({ id: order.id, number: order.number, totalPaise: order.totalPaise })
      .from(order)
      .where(eq(order.id, draft.id))
    if (!o) throw new Error(`sales order ${draft.id} missing`)
    await createPaymentAttempt(ctx, { orderId: o.id, provider: gateway, amountPaise: o.totalPaise })
    return o
  })
}

/**
 * Fees that rode on plan bills which no longer count (cancelled, or replaced by a new bill) are
 * owed again. Their own orders were cancelled when they joined, so they have no pay link until
 * the next plan bill collects them.
 */
async function releaseMergedFees(tx: StoreTx, planOrderIds: string[]): Promise<void> {
  if (planOrderIds.length === 0) return
  await tx
    .update(usageBill)
    .set({
      status: 'due',
      mergedIntoSalesOrderId: null,
      salesOrderId: null,
      salesOrderNumber: null,
    })
    .where(
      and(inArray(usageBill.mergedIntoSalesOrderId, planOrderIds), eq(usageBill.status, 'merged')),
    )
}

/** Whether a sales-store order has been paid (a fee bill paid on its own link). */
async function salesOrderPaid(db: Db, env: BillingEnv, orderId: string): Promise<boolean> {
  const salesStoreId = env.salesStoreId
  if (!salesStoreId) return false
  const [o] = await withStore(db, salesStoreId, (tx) =>
    tx.select({ paid: order.paymentStatus }).from(order).where(eq(order.id, orderId)),
  )
  return o?.paid === 'paid'
}

/**
 * Creates the order that pays for one period of `plan` on the sales store (a draft turned into
 * an open order with a payment attempt waiting), and records it as this store's due bill.
 * Any earlier unpaid bill is cancelled first, so a store never owes two at once. Unpaid
 * per-order fee bills ride along as one more line: they turn `merged` and their own orders are
 * cancelled, so the plan bill's due and paused rules now cover them (owner, 2026-10-28).
 *
 * The fees are claimed in one transaction first, so a fee paid on its own link at the same
 * moment is settled, not billed twice; fees on the bill being replaced move to this one; and a
 * missing fee product only drops the fee line, never the renewal.
 */
export async function createPlanBill(
  db: Db,
  storeId: string,
  input: {
    plan: PlanId
    interval: BillingInterval
    periodStart: Date
    /** A plan change (`quotePlanChange`): its period; prorated or credited, its plan total. */
    quote?: PlanChargeQuote | undefined
  },
  env: BillingEnv,
): Promise<PlanBill> {
  const { quote } = input
  const computed = quote && (quote.prorated || quote.creditPaise > 0) ? quote : null
  const periodEnd = quote ? quote.periodEnd : addInterval(input.periodStart, input.interval)
  const claimed = await withStore(db, storeId, async (tx) => {
    const replaced = await tx
      .select({ id: planPayment.salesOrderId })
      .from(planPayment)
      .where(and(eq(planPayment.storeId, storeId), eq(planPayment.status, 'due')))
    await releaseMergedFees(
      tx,
      replaced.map((r) => r.id),
    )
    return tx
      .update(usageBill)
      .set({ status: 'merged', mergedIntoSalesOrderId: null })
      .where(and(eq(usageBill.storeId, storeId), eq(usageBill.status, 'due')))
      .returning({
        id: usageBill.id,
        totalPaise: usageBill.totalPaise,
        salesOrderId: usageBill.salesOrderId,
      })
  })
  const owed: typeof claimed = []
  const paidAlready: string[] = []
  for (const f of claimed) {
    if (f.salesOrderId && (await salesOrderPaid(db, env, f.salesOrderId))) paidAlready.push(f.id)
    else owed.push(f)
  }
  const setFees = (ids: string[], set: Partial<typeof usageBill.$inferInsert>) =>
    ids.length === 0
      ? Promise.resolve()
      : withStore(db, storeId, async (tx) => {
          await tx.update(usageBill).set(set).where(inArray(usageBill.id, ids))
        })
  await setFees(paidAlready, { status: 'paid', paidAt: new Date() })
  const owedIds = owed.map((f) => f.id)
  const feesPaise = owed.reduce((n, f) => n + f.totalPaise, 0)
  const placeBill = (withFees: boolean) =>
    placeSalesOrder(db, env, storeId, {
      lines: [
        {
          sku: planSku(input.plan, input.interval),
          ...(computed ? { unitPricePaise: computed.planTotalPaise } : {}),
        },
        ...(withFees
          ? [{ sku: usageFeeSku('carried'), unitPricePaise: withFeeGst(feesPaise) }]
          : []),
      ],
      note: (buyer) =>
        [
          `${siteConfig.brand.name} ${input.plan} (${input.interval}) for ${buyer}, store ${storeId}`,
          computed ? quoteNote(computed, input.periodStart, periodEnd) : null,
        ]
          .filter(Boolean)
          .join('. '),
    })
  let withFees = feesPaise > 0
  let sale: Awaited<ReturnType<typeof placeSalesOrder>>
  try {
    sale = await placeBill(withFees)
  } catch (err) {
    // The fees stay owed on their own bills, with the pay links they had.
    await setFees(owedIds, { status: 'due', mergedIntoSalesOrderId: null })
    const noFeeProduct =
      withFees && err instanceof BillingNotReady && err.reason === 'no_plan_product'
    if (!noFeeProduct) throw err
    withFees = false
    sale = await placeBill(false)
  }

  const bill = await withStore(db, storeId, async (tx) => {
    await tx
      .update(planPayment)
      .set({ status: 'cancelled' })
      .where(and(eq(planPayment.storeId, storeId), eq(planPayment.status, 'due')))
    const [row] = await tx
      .insert(planPayment)
      .values({
        storeId,
        plan: input.plan,
        interval: input.interval,
        salesOrderId: sale.id,
        salesOrderNumber: sale.number,
        amountPaise: sale.totalPaise,
        periodStart: input.periodStart,
        periodEnd,
        status: 'due',
        prorated: quote?.prorated ?? false,
        creditPaise: quote?.creditPaise ?? 0,
      })
      .returning()
    if (!row) throw new Error('plan bill insert returned nothing')
    if (withFees)
      await tx
        .update(usageBill)
        .set({ mergedIntoSalesOrderId: sale.id })
        .where(inArray(usageBill.id, owedIds))
    return row
  })
  // Their old pay links stop working; `cancelUsageBill` leaves a merged bill as it is.
  const salesStoreId = env.salesStoreId
  if (salesStoreId && withFees)
    for (const f of owed) {
      if (!f.salesOrderId) continue
      const orderId = f.salesOrderId
      await withStore(db, salesStoreId, (tx) =>
        cancelOrder({ storeId: salesStoreId, tx }, orderId, { notifyCustomer: false }),
      )
    }
  return toBill(env, bill)
}

/** Drops a scheduled downgrade. */
export async function keepCurrentPlan(tx: StoreTx, storeId: string, now = new Date()) {
  await tx
    .update(storePlan)
    .set({ nextPlan: null, updatedAt: now })
    .where(eq(storePlan.storeId, storeId))
}

/**
 * The sales store's `order.paid` hook: when the paid order is a plan bill, the bill is marked
 * paid and the store moves onto that plan for the bill's period. Safe to run twice.
 */
export async function markPlanBillPaid(
  db: Db,
  salesOrderId: string,
  now = new Date(),
): Promise<{ storeId: string } | null> {
  const rows = await db.execute<{ id: string | null }>(
    sql`select plan_payment_store(${salesOrderId}::uuid) as id`,
  )
  const storeId = rows[0]?.id
  if (!storeId) return null
  await withStore(db, storeId, async (tx) => {
    const [bill] = await tx
      .select()
      .from(planPayment)
      .where(eq(planPayment.salesOrderId, salesOrderId))
    if (!bill || bill.status === 'paid') return
    // Paid late: the period starts when the money arrived, never in the past.
    const start = bill.periodStart > now ? bill.periodStart : now
    const end = paidPeriodEnd(bill, start, now)
    await tx
      .update(planPayment)
      .set({ status: 'paid', paidAt: now, periodStart: start, periodEnd: end })
      .where(eq(planPayment.id, bill.id))
    await tx
      .update(storePlan)
      .set({
        plan: bill.plan,
        interval: bill.interval,
        status: 'active',
        periodStart: start,
        periodEnd: end,
        nextPlan: null,
        updatedAt: now,
      })
      .where(eq(storePlan.storeId, storeId))
    await tx
      .update(aiSettings)
      .set({ plan: PLANS[bill.plan].ai })
      .where(eq(aiSettings.storeId, storeId))
    // Per-order fees that rode on this bill are paid with it.
    await tx
      .update(usageBill)
      .set({ status: 'paid', paidAt: now })
      .where(
        and(eq(usageBill.mergedIntoSalesOrderId, salesOrderId), eq(usageBill.status, 'merged')),
      )
  })
  return { storeId }
}

/** The sales store cancelled or fully refunded a plan order: its bill no longer counts. */
export async function cancelPlanBill(db: Db, salesOrderId: string): Promise<void> {
  const rows = await db.execute<{ id: string | null }>(
    sql`select plan_payment_store(${salesOrderId}::uuid) as id`,
  )
  const storeId = rows[0]?.id
  if (!storeId) return
  await withStore(db, storeId, async (tx) => {
    const cancelled = await tx
      .update(planPayment)
      .set({ status: 'cancelled' })
      .where(and(eq(planPayment.salesOrderId, salesOrderId), eq(planPayment.status, 'due')))
      .returning({ id: planPayment.id })
    // Fees that rode on it are owed again; the next plan bill collects them.
    if (cancelled.length > 0) await releaseMergedFees(tx, [salesOrderId])
  })
}

/** The sales-store SKU a fee line is billed on: one per plan rate, and one for carried fees. */
export const usageFeeSku = (plan: PlanId | 'carried'): string => `usage-fee-${plan}`

// Plan changes and per-order fee bills live in their own modules; re-exported for callers.
export { AlreadyOnPlan, choosePlan, loadPlanChangeQuote } from './plan-change'
export {
  cancelUsageBill,
  markUsageBillPaid,
  runUsageBilling,
  runUsageReminders,
  type UsageBillingResult,
} from './usage-billing'

export type BillingSweepResult = { stores: number; billed: number; due: number; paused: number }

/**
 * Daily: bills renewals a few days before a trial or period ends, marks a store `due` once its
 * paid time is over, and pauses it after the grace period. Nothing is ever deleted.
 */
export async function runBillingSweep(
  db: Db,
  env: BillingEnv,
  now = new Date(),
): Promise<BillingSweepResult> {
  const result: BillingSweepResult = { stores: 0, billed: 0, due: 0, paused: 0 }
  const ids = await db.execute<{ id: string }>(
    sql`select stores_with_plan_due(${now.toISOString()}::timestamptz) as id`,
  )
  for (const { id: storeId } of ids) {
    result.stores++
    const { row, open } = await withStore(db, storeId, async (tx) => {
      const [r] = await tx.select().from(storePlan).where(eq(storePlan.storeId, storeId))
      const [o] = await tx
        .select({ id: planPayment.id })
        .from(planPayment)
        .where(and(eq(planPayment.storeId, storeId), eq(planPayment.status, 'due')))
      return { row: r, open: Boolean(o) }
    })
    // Koomerce's own unlimited stores are never billed, made due or paused.
    if (!row || row.unlimited) continue
    // Never paid (a trial that ran out): its time ends with the trial.
    const ends = row.periodEnd ?? row.trialEndsAt
    if (!ends) continue
    // While UPI AutoPay charges the plan, Razorpay bills it; no pay link is needed.
    const charging = await autopayActive(db, storeId)
    if (!open && !charging && ends.getTime() - now.getTime() <= RENEW_AHEAD_DAYS * DAY_MS) {
      try {
        const bill = await createPlanBill(
          db,
          storeId,
          {
            plan: row.nextPlan ?? row.plan,
            interval: row.interval,
            periodStart: ends > now ? ends : now,
          },
          env,
        )
        result.billed++
        await sendPlanBillEmail(db, storeId, {
          kind: 'renewal',
          what: planBillWhat(bill.plan, bill.interval),
          amountPaise: bill.amountPaise,
          due: ends,
          url: bill.url,
        })
      } catch (err) {
        if (!(err instanceof BillingNotReady)) throw err
      }
    }
    const next =
      ends.getTime() + GRACE_DAYS * DAY_MS < now.getTime()
        ? 'paused'
        : ends < now
          ? 'due'
          : row.status
    if (next !== row.status && row.status !== 'paused' && row.status !== 'cancelled') {
      await withStore(db, storeId, (tx) =>
        tx
          .update(storePlan)
          .set({ status: next, updatedAt: now })
          .where(eq(storePlan.storeId, storeId)),
      )
      if (next === 'due') {
        result.due++
        const bill = await withStore(db, storeId, async (tx) => {
          const [b] = await tx
            .select()
            .from(planPayment)
            .where(and(eq(planPayment.storeId, storeId), eq(planPayment.status, 'due')))
          return b ? toBill(env, b) : null
        })
        if (bill)
          await sendPlanBillEmail(db, storeId, {
            kind: 'overdue',
            what: planBillWhat(bill.plan, bill.interval),
            amountPaise: bill.amountPaise,
            due: ends,
            url: bill.url,
          })
      }
      if (next === 'paused') result.paused++
    }
  }
  return result
}

/** Orders a month, as a fraction of the plan, for the sidebar card. */
export function orderAllowance(view: Pick<PlanView, 'plan' | 'usage'>) {
  return { used: view.usage.orders, limit: PLANS[view.plan].orders }
}

export type { StorePlanRow }

/** The billing settings for one request or sweep: the sales store and its storefront address. */
export async function resolveBillingEnv(
  db: Db,
  opts: { salesStoreId: string | undefined; settingsSecret: string; storefrontUrl: string },
): Promise<BillingEnv> {
  const { salesStoreId } = opts
  if (!salesStoreId) {
    return {
      salesStoreId: undefined,
      settingsSecret: opts.settingsSecret,
      salesStorefrontUrl: null,
    }
  }
  const salesStorefrontUrl = await withStore(db, salesStoreId, (tx) =>
    storefrontOriginFor(tx, salesStoreId, opts.storefrontUrl),
  )
  return { salesStoreId, settingsSecret: opts.settingsSecret, salesStorefrontUrl }
}
