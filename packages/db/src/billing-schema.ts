import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { newId, store } from './schema'

/*
 * A store's Koomerce plan (Settings → Plan & billing). Payments are orders on the platform's
 * own sales store (PLATFORM_SALES_STORE_ID), so its GST-invoice app issues the tax invoice
 * and its checkout takes the money; these tables only remember which order paid for what.
 */

const STORE_PLANS = ['starter', 'growth', 'pro', 'scale'] as const
export type StorePlanId = (typeof STORE_PLANS)[number]

const PLAN_INTERVALS = ['month', 'year'] as const
export type PlanInterval = (typeof PLAN_INTERVALS)[number]

/**
 * `trialing`: the first 14 days. `active`: paid through `periodEnd`. `due`: a renewal order
 * waits for payment. `paused`: the grace period ran out unpaid. `cancelled`: closed by the owner.
 */
const STORE_PLAN_STATUSES = ['trialing', 'active', 'due', 'paused', 'cancelled'] as const
export type StorePlanStatus = (typeof STORE_PLAN_STATUSES)[number]

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)

export const storePlan = pgTable(
  'store_plan',
  {
    id: id(),
    storeId: storeId(),
    plan: text('plan').$type<StorePlanId>().notNull().default('growth'),
    interval: text('interval').$type<PlanInterval>().notNull().default('month'),
    status: text('status').$type<StorePlanStatus>().notNull().default('trialing'),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    /** The paid span; null until the first payment. */
    periodStart: timestamp('period_start', { withTimezone: true }),
    periodEnd: timestamp('period_end', { withTimezone: true }),
    /** A downgrade the owner asked for, applied when the current period ends. */
    nextPlan: text('next_plan').$type<StorePlanId>(),
    /**
     * The last finished month (`YYYY-MM`) that closed two months running over the plan's
     * fair-use visits; the admin shows a notice while it is last month. Nothing is blocked.
     */
    fairUseNoticeMonth: text('fair_use_notice_month'),
    /**
     * Koomerce's own stores (Waimers): Scale's features with no limits, fees, bills or fair-use
     * notices. Set only by `bun run platform:unlimited`, never by a merchant.
     */
    unlimited: boolean('unlimited').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('store_plan_store').on(t.storeId),
    check('store_plan_plan', sql`${t.plan} in ('starter','growth','pro','scale')`),
    check('store_plan_interval', sql`${t.interval} in ('month','year')`),
    check(
      'store_plan_status',
      sql`${t.status} in ('trialing','active','due','paused','cancelled')`,
    ),
  ],
)

/**
 * `carried`: under ₹100, added to the next month instead of billed. `due`: billed, waiting.
 * `merged`: a carried month taken into the next bill, or an unpaid bill added to the next plan
 * bill (`mergedIntoSalesOrderId`). `paid`, `cancelled` as for plan bills.
 */
const USAGE_BILL_STATUSES = ['carried', 'due', 'merged', 'paid', 'cancelled'] as const
export type UsageBillStatus = (typeof USAGE_BILL_STATUSES)[number]

/** One plan rate's share of a month's fee (`packages/core/src/billing/usage-fee.ts` FeeLine). */
export type UsageBillLine = {
  plan: StorePlanId
  basisPoints: number
  orders: number
  feePaise: number
}

/**
 * One month of per-order fees for one store: what was counted, and the order on the sales store
 * that bills it (none when the month was carried). One row per store and month.
 */
export const usageBill = pgTable(
  'usage_bill',
  {
    id: id(),
    storeId: storeId(),
    /** `YYYY-MM`, the IST calendar month the orders were placed in. */
    month: text('month').notNull(),
    ordersCounted: integer('orders_counted').notNull(),
    feeOrders: integer('fee_orders').notNull(),
    feePaise: integer('fee_paise').notNull(),
    carriedInPaise: integer('carried_in_paise').notNull().default(0),
    totalPaise: integer('total_paise').notNull(),
    lines: jsonb('lines').$type<UsageBillLine[]>().notNull().default([]),
    /** The order on the sales store (another store, so no foreign key). */
    salesOrderId: uuid('sales_order_id'),
    salesOrderNumber: integer('sales_order_number'),
    /** The plan bill's sales order an unpaid usage bill was added to. */
    mergedIntoSalesOrderId: uuid('merged_into_sales_order_id'),
    status: text('status').$type<UsageBillStatus>().notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    /** Reminder emails sent while it is `due` (3 and 7 days after it was billed). */
    remindersSent: integer('reminders_sent').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('usage_bill_month').on(t.storeId, t.month),
    uniqueIndex('usage_bill_order').on(t.salesOrderId),
    index('usage_bill_store').on(t.storeId, t.createdAt),
    index('usage_bill_merged').on(t.mergedIntoSalesOrderId),
    check('usage_bill_status', sql`${t.status} in ('carried','due','merged','paid','cancelled')`),
  ],
)

const PLAN_PAYMENT_STATUSES = ['due', 'paid', 'cancelled'] as const
export type PlanPaymentStatus = (typeof PLAN_PAYMENT_STATUSES)[number]

/** One bill: the order on the sales store that pays for one period of one plan. */
export const planPayment = pgTable(
  'plan_payment',
  {
    id: id(),
    storeId: storeId(),
    plan: text('plan').$type<StorePlanId>().notNull(),
    interval: text('interval').$type<PlanInterval>().notNull(),
    /** The order on the sales store (another store, so no foreign key). */
    salesOrderId: uuid('sales_order_id').notNull(),
    salesOrderNumber: integer('sales_order_number').notNull(),
    amountPaise: integer('amount_paise').notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    status: text('status').$type<PlanPaymentStatus>().notNull().default('due'),
    /**
     * The rest of a period after an upgrade (migration 0246): paying it keeps `periodEnd`, so the
     * renewal date does not move. False for a full interval (renewals, a first plan).
     */
    prorated: boolean('prorated').notNull().default(false),
    /** The old plan's unused days taken off this bill, before GST, in paise. */
    creditPaise: integer('credit_paise').notNull().default(0),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('plan_payment_store').on(t.storeId, t.createdAt),
    uniqueIndex('plan_payment_order').on(t.salesOrderId),
    check('plan_payment_status', sql`${t.status} in ('due','paid','cancelled')`),
  ],
)

/**
 * `due`: billed, waiting for payment. `active`: paid through `periodEnd`, renewing monthly.
 * `cancelled`: the owner stopped it (the app keeps working until `periodEnd`), or the bill was
 * cancelled before it was paid.
 */
const APP_PURCHASE_STATUSES = ['due', 'active', 'cancelled'] as const
export type AppPurchaseStatus = (typeof APP_PURCHASE_STATUSES)[number]

/**
 * A paid app bought on a plan that does not include it (Starter, Growth): one row per month
 * billed, each an order on the sales store like a plan bill.
 */
export const appPurchase = pgTable(
  'app_purchase',
  {
    id: id(),
    storeId: storeId(),
    pluginId: text('plugin_id').notNull(),
    status: text('status').$type<AppPurchaseStatus>().notNull().default('due'),
    salesOrderId: uuid('sales_order_id').notNull(),
    salesOrderNumber: integer('sales_order_number').notNull(),
    amountPaise: integer('amount_paise').notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('app_purchase_store').on(t.storeId, t.pluginId, t.createdAt),
    uniqueIndex('app_purchase_order').on(t.salesOrderId),
    check('app_purchase_status', sql`${t.status} in ('due','active','cancelled')`),
  ],
)

/** A top-up of AI credits (₹199 for 1,000), bought as an order on the sales store. */
export const aiCreditTopup = pgTable(
  'ai_credit_topup',
  {
    id: id(),
    storeId: storeId(),
    credits: integer('credits').notNull(),
    status: text('status').$type<PlanPaymentStatus>().notNull().default('due'),
    salesOrderId: uuid('sales_order_id').notNull(),
    salesOrderNumber: integer('sales_order_number').notNull(),
    amountPaise: integer('amount_paise').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ai_credit_topup_store').on(t.storeId, t.createdAt),
    uniqueIndex('ai_credit_topup_order').on(t.salesOrderId),
    check('ai_credit_topup_status', sql`${t.status} in ('due','paid','cancelled')`),
  ],
)

const AUTOPAY_STATUSES = ['created', 'active', 'halted', 'cancelled'] as const
export type AutopayStatus = (typeof AUTOPAY_STATUSES)[number]

/**
 * UPI AutoPay: a Razorpay subscription on the platform's own Razorpay account that charges the
 * store's plan every period. `created` until the owner approves the mandate, `active` while it
 * charges, `halted` after Razorpay gave up retrying a charge, `cancelled` when turned off.
 */
export const autopayMandate = pgTable(
  'autopay_mandate',
  {
    id: id(),
    storeId: storeId(),
    plan: text('plan').$type<StorePlanId>().notNull(),
    interval: text('interval').$type<PlanInterval>().notNull(),
    subscriptionId: text('subscription_id').notNull(),
    status: text('status').$type<AutopayStatus>().notNull().default('created'),
    /** Where the owner approves the mandate (Razorpay's hosted page). */
    shortUrl: text('short_url'),
    /** The last Razorpay payment turned into a paid bill, so a repeated webhook is a no-op. */
    lastPaymentId: text('last_payment_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('autopay_mandate_store').on(t.storeId, t.createdAt),
    uniqueIndex('autopay_mandate_subscription').on(t.subscriptionId),
    check('autopay_mandate_status', sql`${t.status} in ('created','active','halted','cancelled')`),
  ],
)
