/** SOURCE OF TRUTH: store plans and plan bills — WHAT a store's plan is, what it owes, and how a
 * bill becomes an order on the platform's sales store / WHY payments, GST invoices and receipts
 * already work there (checkout, Razorpay, the GST-invoice app); billing only remembers which
 * order paid for which period. Pay-by-link for now (UPI AutoPay later).
 */

import { siteConfig } from '@commerce/config/site'
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
  PLANS,
  type PlanId,
  planRank,
  planSku,
  RENEW_AHEAD_DAYS,
  TRIAL_DAYS,
} from './plans'
import { type PlanUsage, planUsage } from './usage'
import { billable, monthFee } from './usage-fee'
import { loadMonthFeeInputs, monthOf, monthRange, previousMonth } from './usage-fee-service'

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
  const [usage, bills, [contact]] = await Promise.all([
    planUsage(tx, now),
    tx
      .select()
      .from(planPayment)
      .where(eq(planPayment.storeId, storeId))
      .orderBy(desc(planPayment.createdAt))
      .limit(24),
    tx.select({ email: store.contactEmail }).from(store).where(eq(store.id, storeId)),
  ])
  const shown = bills.map((b) => toBill(env, b))
  return {
    plan: row.plan,
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
 * Creates the order that pays for one period of `plan` on the sales store (a draft turned into
 * an open order with a payment attempt waiting), and records it as this store's due bill.
 * Any earlier unpaid bill is cancelled first, so a store never owes two at once. Unpaid
 * per-order fee bills ride along as one more line: they turn `merged` and their own orders are
 * cancelled, so the plan bill's due and paused rules now cover them (owner, 2026-10-28).
 */
export async function createPlanBill(
  db: Db,
  storeId: string,
  input: { plan: PlanId; interval: BillingInterval; periodStart: Date },
  env: BillingEnv,
): Promise<PlanBill> {
  const periodEnd = addInterval(input.periodStart, input.interval)
  const unpaidFees = await withStore(db, storeId, (tx) =>
    tx
      .select({
        id: usageBill.id,
        totalPaise: usageBill.totalPaise,
        salesOrderId: usageBill.salesOrderId,
      })
      .from(usageBill)
      .where(and(eq(usageBill.storeId, storeId), eq(usageBill.status, 'due'))),
  )
  const feesPaise = unpaidFees.reduce((n, f) => n + f.totalPaise, 0)
  const sale = await placeSalesOrder(db, env, storeId, {
    lines: [
      { sku: planSku(input.plan, input.interval) },
      ...(feesPaise > 0 ? [{ sku: usageFeeSku('carried'), unitPricePaise: feesPaise }] : []),
    ],
    note: (buyer) =>
      `${siteConfig.brand.name} ${input.plan} (${input.interval}) for ${buyer}, store ${storeId}`,
  })

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
    if (unpaidFees.length > 0)
      await tx
        .update(usageBill)
        .set({ status: 'merged', mergedIntoSalesOrderId: sale.id })
        .where(
          inArray(
            usageBill.id,
            unpaidFees.map((f) => f.id),
          ),
        )
    return row
  })
  // Their old pay links stop working; `cancelUsageBill` leaves a merged bill as it is.
  const salesStoreId = env.salesStoreId
  if (salesStoreId)
    for (const f of unpaidFees) {
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
  await withStore(db, storeId, (tx) =>
    tx
      .update(planPayment)
      .set({ status: 'cancelled' })
      .where(and(eq(planPayment.salesOrderId, salesOrderId), eq(planPayment.status, 'due'))),
  )
}

/** The sales-store SKU a fee line is billed on: one per plan rate, and one for carried fees. */
export const usageFeeSku = (plan: PlanId | 'carried'): string => `usage-fee-${plan}`

/** "October 2026" for the bill and its email. */
const monthLabel = (month: string): string =>
  new Date(`${month}-15T00:00:00Z`).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

export type UsageBillingResult = { stores: number; billed: number; carried: number }

/**
 * The 1st's per-order fee bill for the month that just ended, for every store that had paid
 * plan time in it. Runs with the hourly sweep and is idempotent: a store and month get one
 * `usage_bill` row, so later runs skip it. Under ₹100 (with what was carried in) the month is
 * recorded as `carried`; otherwise one order on the sales store, a line per plan rate plus one
 * for carried fees, and an email with the pay link. Never changes a store's plan status.
 */
export async function runUsageBilling(
  db: Db,
  env: BillingEnv,
  now = new Date(),
): Promise<UsageBillingResult> {
  const result: UsageBillingResult = { stores: 0, billed: 0, carried: 0 }
  const month = previousMonth(monthOf(now))
  const { start, end } = monthRange(month)
  const ids = await db.execute<{ id: string }>(
    sql`select stores_with_paid_period(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz) as id`,
  )
  for (const { id: storeId } of ids) {
    result.stores++
    const input = await withStore(db, storeId, async (tx) => {
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
      return { fee: monthFee(orders, periods), carried }
    })
    if (!input) continue
    const carriedIn = input.carried.reduce((n, c) => n + c.totalPaise, 0)
    const { bill, totalPaise } = billable(input.fee.feePaise, carriedIn)
    let sale: { id: string; number: number; totalPaise: number } | null = null
    if (bill) {
      try {
        sale = await placeSalesOrder(db, env, storeId, {
          lines: [
            ...input.fee.lines.map((l) => ({
              sku: usageFeeSku(l.plan),
              unitPricePaise: l.feePaise,
            })),
            ...(carriedIn > 0 ? [{ sku: usageFeeSku('carried'), unitPricePaise: carriedIn }] : []),
          ],
          note: (buyer) =>
            `${siteConfig.brand.name} per-order fees ${month} for ${buyer}, store ${storeId}`,
        })
      } catch (err) {
        // Not set up yet: no row, so the next run tries again.
        if (err instanceof BillingNotReady) continue
        throw err
      }
    }
    const written = await withStore(db, storeId, async (tx) => {
      const [row] = await tx
        .insert(usageBill)
        .values({
          storeId,
          month,
          ordersCounted: input.fee.ordersCounted,
          feeOrders: input.fee.feeOrders,
          feePaise: input.fee.feePaise,
          carriedInPaise: carriedIn,
          totalPaise,
          lines: input.fee.lines,
          salesOrderId: sale?.id ?? null,
          salesOrderNumber: sale?.number ?? null,
          status: sale ? 'due' : 'carried',
        })
        .onConflictDoNothing({ target: [usageBill.storeId, usageBill.month] })
        .returning({ id: usageBill.id })
      if (row && input.carried.length > 0)
        await tx
          .update(usageBill)
          .set({ status: 'merged' })
          .where(
            inArray(
              usageBill.id,
              input.carried.map((c) => c.id),
            ),
          )
      return Boolean(row)
    })
    if (!written) continue
    if (!sale) {
      result.carried++
      continue
    }
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
  const updated = await withStore(db, storeId, (tx) =>
    tx
      .update(usageBill)
      .set({ status: 'paid', paidAt: now })
      .where(and(eq(usageBill.salesOrderId, salesOrderId), eq(usageBill.status, 'due')))
      .returning({ id: usageBill.id }),
  )
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
    if (!row) continue
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
