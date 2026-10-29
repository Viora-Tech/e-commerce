/** SOURCE OF TRUTH: store plans and plan bills — WHAT a store's plan is, what it owes, and how a
 * bill becomes an order on the platform's sales store / WHY payments, GST invoices and receipts
 * already work there (checkout, Razorpay, the GST-invoice app); billing only remembers which
 * order paid for which period. Pay-by-link for now (UPI AutoPay later).
 */

import { siteConfig } from '@commerce/config/site'
import { formatInZone } from '@commerce/dates'
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
import {
  addInterval,
  type BillingInterval,
  GRACE_DAYS,
  PLAN_GST_PERCENT,
  PLANS,
  type PlanId,
  planRank,
  planSku,
  RENEW_AHEAD_DAYS,
  TRIAL_DAYS,
} from './plans'
import { type PlanUsage, planUsage } from './usage'
import { billable, monthFee } from './usage-fee'
import {
  billingMonth,
  feeEstimate,
  loadMonthFeeInputs,
  monthRange,
  previousMonth,
} from './usage-fee-service'

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

/** The store's plan row, made on first read: a 14-day Growth trial. */
export async function ensureStorePlan(
  tx: StoreTx,
  storeId: string,
  now = new Date(),
): Promise<StorePlanRow> {
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
const salesOrderUrl = (env: BillingEnv, id: string, number: number): string | null =>
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
  const usageBills = feeBills.map(
    (b): UsageBillView => ({
      id: b.id,
      month: b.month,
      ordersCounted: b.ordersCounted,
      feeOrders: b.feeOrders,
      totalPaise: b.totalPaise,
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
    unpaidFees: feeBills.filter((b) => b.status === 'due').reduce((n, b) => n + b.totalPaise, 0),
    fairUseNotice: row.fairUseNoticeMonth === previousMonth(billingMonth(now)),
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
  input: { plan: PlanId; interval: BillingInterval; periodStart: Date },
  env: BillingEnv,
): Promise<PlanBill> {
  const periodEnd = addInterval(input.periodStart, input.interval)
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
        { sku: planSku(input.plan, input.interval) },
        ...(withFees ? [{ sku: usageFeeSku('carried'), unitPricePaise: feesPaise }] : []),
      ],
      note: (buyer) =>
        `${siteConfig.brand.name} ${input.plan} (${input.interval}) for ${buyer}, store ${storeId}`,
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

/**
 * The owner picked a plan. An upgrade (or any plan while trialing, due or paused) is billed now
 * and starts when paid; a downgrade on an active plan waits for the period to end.
 */
export async function choosePlan(
  db: Db,
  storeId: string,
  input: { plan: PlanId; interval: BillingInterval },
  env: BillingEnv,
  now = new Date(),
): Promise<{ bill: PlanBill | null; scheduled: boolean }> {
  const row = await withStore(db, storeId, (tx) => ensureStorePlan(tx, storeId, now))
  if (row.unlimited) throw new UnlimitedPlan()
  const cheaper =
    planRank(input.plan) < planRank(row.plan) ||
    (input.plan === row.plan && input.interval === 'month' && row.interval === 'year')
  if (row.status === 'active' && cheaper && row.periodEnd && row.periodEnd > now) {
    await withStore(db, storeId, (tx) =>
      tx
        .update(storePlan)
        .set({ nextPlan: input.plan, updatedAt: now })
        .where(eq(storePlan.storeId, storeId)),
    )
    return { bill: null, scheduled: true }
  }
  const bill = await createPlanBill(db, storeId, { ...input, periodStart: now }, env)
  return { bill, scheduled: false }
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
    const end = addInterval(start, bill.interval)
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
const usageFeeSku = (plan: PlanId | 'carried'): string => `usage-fee-${plan}`

/** "October 2026" for the bill and its email. */
const monthLabel = (month: string): string =>
  formatInZone(`${month}-15T00:00:00Z`, { month: 'long', year: 'numeric' }, { timeZone: 'UTC' })

export type UsageBillingResult = { stores: number; billed: number; carried: number }

/**
 * The 1st's per-order fee bill for the month that just ended, for every store that had paid
 * plan time in it. Runs with the hourly sweep and is idempotent: a store and month get one
 * `usage_bill` row, written first as a claim (the unique index lets one sweep win when two
 * overlap), so later runs skip it. Under ₹100 (with what was carried in) the month is recorded
 * as `carried`; otherwise one order on the sales store, a line per plan rate plus one for
 * carried fees, and an email with the pay link. Never changes a store's plan status.
 */
export async function runUsageBilling(
  db: Db,
  env: BillingEnv,
  now = new Date(),
): Promise<UsageBillingResult> {
  const result: UsageBillingResult = { stores: 0, billed: 0, carried: 0 }
  const month = previousMonth(billingMonth(now))
  const { start, end } = monthRange(month)
  const ids = await db.execute<{ id: string }>(
    sql`select stores_with_paid_period(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz) as id`,
  )
  for (const { id: storeId } of ids) {
    result.stores++
    const claim = await withStore(db, storeId, async (tx) => {
      const [done] = await tx
        .select({ id: usageBill.id })
        .from(usageBill)
        .where(and(eq(usageBill.storeId, storeId), eq(usageBill.month, month)))
      if (done) return null
      const carried = await tx
        .select({ id: usageBill.id, totalPaise: usageBill.totalPaise })
        .from(usageBill)
        .where(and(eq(usageBill.storeId, storeId), eq(usageBill.status, 'carried')))
      const { orders, periods } = await loadMonthFeeInputs(tx, storeId, month)
      const fee = monthFee(orders, periods)
      const carriedIn = carried.reduce((n, c) => n + c.totalPaise, 0)
      const { bill, totalPaise } = billable(fee.feePaise, carriedIn)
      const [row] = await tx
        .insert(usageBill)
        .values({
          storeId,
          month,
          ordersCounted: fee.ordersCounted,
          feeOrders: fee.feeOrders,
          feePaise: fee.feePaise,
          carriedInPaise: carriedIn,
          totalPaise,
          lines: fee.lines,
          status: bill ? 'due' : 'carried',
          createdAt: now,
        })
        .onConflictDoNothing({ target: [usageBill.storeId, usageBill.month] })
        .returning({ id: usageBill.id })
      if (!row) return null
      const carriedIds = carried.map((c) => c.id)
      // A carried month folds in now; a billed one once its order exists.
      if (!bill && carriedIds.length > 0)
        await tx
          .update(usageBill)
          .set({ status: 'merged' })
          .where(inArray(usageBill.id, carriedIds))
      return { id: row.id, bill, fee, carriedIn, carriedIds }
    })
    if (!claim) continue
    if (!claim.bill) {
      result.carried++
      continue
    }
    let sale: Awaited<ReturnType<typeof placeSalesOrder>>
    try {
      sale = await placeSalesOrder(db, env, storeId, {
        lines: [
          ...claim.fee.lines.map((l) => ({
            sku: usageFeeSku(l.plan),
            unitPricePaise: l.feePaise,
          })),
          ...(claim.carriedIn > 0
            ? [{ sku: usageFeeSku('carried'), unitPricePaise: claim.carriedIn }]
            : []),
        ],
        note: (buyer) =>
          `${siteConfig.brand.name} per-order fees ${month} for ${buyer}, store ${storeId}`,
      })
    } catch (err) {
      // No order: drop the claim so the next run tries again.
      await withStore(db, storeId, (tx) => tx.delete(usageBill).where(eq(usageBill.id, claim.id)))
      if (err instanceof BillingNotReady) continue
      throw err
    }
    await withStore(db, storeId, async (tx) => {
      await tx
        .update(usageBill)
        .set({ salesOrderId: sale.id, salesOrderNumber: sale.number })
        .where(eq(usageBill.id, claim.id))
      if (claim.carriedIds.length > 0)
        await tx
          .update(usageBill)
          .set({ status: 'merged', mergedIntoSalesOrderId: sale.id })
          .where(inArray(usageBill.id, claim.carriedIds))
    })
    result.billed++
    await sendPlanBillEmail(db, storeId, {
      kind: 'usage',
      what: `Per-order fees for ${monthLabel(month)}`,
      amountPaise: sale.totalPaise,
      due: new Date(now.getTime() + GRACE_DAYS * DAY_MS),
      url: salesOrderUrl(env, sale.id, sale.number),
    })
  }
  return result
}

/** Days after billing that an unpaid fee bill is reminded about, one email each. */
const USAGE_REMINDER_DAYS = [3, 7] as const

/**
 * Reminder emails for fee bills still `due` with a pay link: 3 and 7 days after they were
 * billed. Nothing is paused; an unpaid fee joins the next plan bill.
 */
export async function runUsageReminders(
  db: Db,
  env: BillingEnv,
  now = new Date(),
): Promise<{ reminded: number }> {
  const result = { reminded: 0 }
  const ids = await db.execute<{ id: string }>(sql`select stores_with_due_usage_bills() as id`)
  for (const { id: storeId } of ids) {
    const due = await withStore(db, storeId, async (tx) => {
      const rows = await tx
        .select()
        .from(usageBill)
        .where(and(eq(usageBill.storeId, storeId), eq(usageBill.status, 'due')))
      const out: (typeof rows)[number][] = []
      for (const b of rows) {
        const after = USAGE_REMINDER_DAYS[b.remindersSent]
        if (!b.salesOrderId || after === undefined) continue
        if (now.getTime() - b.createdAt.getTime() < after * DAY_MS) continue
        // The guard on the old count keeps two sweeps from sending the same reminder.
        const [won] = await tx
          .update(usageBill)
          .set({ remindersSent: b.remindersSent + 1 })
          .where(and(eq(usageBill.id, b.id), eq(usageBill.remindersSent, b.remindersSent)))
          .returning({ id: usageBill.id })
        if (won) out.push(b)
      }
      return out
    })
    for (const b of due) {
      if (!b.salesOrderId || b.salesOrderNumber === null) continue
      result.reminded++
      await sendPlanBillEmail(db, storeId, {
        kind: 'usage',
        what: `Per-order fees for ${monthLabel(b.month)}`,
        // The bill's own order added GST on the sales store; the row keeps the amount before it.
        amountPaise: Math.round((b.totalPaise * (100 + PLAN_GST_PERCENT)) / 100),
        due: new Date(b.createdAt.getTime() + GRACE_DAYS * DAY_MS),
        url: salesOrderUrl(env, b.salesOrderId, b.salesOrderNumber),
      })
    }
  }
  return result
}

/** The store a fee bill's sales order belongs to (its own order, or the plan bill it joined). */
async function usageBillStore(db: Db, salesOrderId: string): Promise<string | null> {
  const rows = await db.execute<{ id: string | null }>(
    sql`select usage_bill_store(${salesOrderId}::uuid) as id`,
  )
  return rows[0]?.id ?? null
}

/** The sales store's `order.paid` hook for a fee bill. Safe to run twice. */
export async function markUsageBillPaid(
  db: Db,
  salesOrderId: string,
  now = new Date(),
): Promise<{ storeId: string } | null> {
  const storeId = await usageBillStore(db, salesOrderId)
  if (!storeId) return null
  const updated = await withStore(db, storeId, async (tx) => {
    const paid = await tx
      .update(usageBill)
      .set({ status: 'paid', paidAt: now })
      .where(and(eq(usageBill.salesOrderId, salesOrderId), eq(usageBill.status, 'due')))
      .returning({ id: usageBill.id })
    // Earlier months it carried are paid with it.
    if (paid.length > 0)
      await tx
        .update(usageBill)
        .set({ status: 'paid', paidAt: now })
        .where(
          and(eq(usageBill.mergedIntoSalesOrderId, salesOrderId), eq(usageBill.status, 'merged')),
        )
    return paid
  })
  return updated.length > 0 ? { storeId } : null
}

/**
 * The sales store cancelled or fully refunded a fee bill's order. Only a `due` bill turns
 * `cancelled`: a bill already added to a plan bill (`merged`) stays owed through that one.
 */
export async function cancelUsageBill(db: Db, salesOrderId: string): Promise<void> {
  const storeId = await usageBillStore(db, salesOrderId)
  if (!storeId) return
  await withStore(db, storeId, (tx) =>
    tx
      .update(usageBill)
      .set({ status: 'cancelled' })
      .where(and(eq(usageBill.salesOrderId, salesOrderId), eq(usageBill.status, 'due'))),
  )
}

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
