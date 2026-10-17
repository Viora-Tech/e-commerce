import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
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

export const STORE_PLANS = ['starter', 'growth', 'pro'] as const
export type StorePlanId = (typeof STORE_PLANS)[number]

export const PLAN_INTERVALS = ['month', 'year'] as const
export type PlanInterval = (typeof PLAN_INTERVALS)[number]

/**
 * `trialing`: the first 14 days. `active`: paid through `periodEnd`. `due`: a renewal order
 * waits for payment. `paused`: the grace period ran out unpaid. `cancelled`: closed by the owner.
 */
export const STORE_PLAN_STATUSES = ['trialing', 'active', 'due', 'paused', 'cancelled'] as const
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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('store_plan_store').on(t.storeId),
    check('store_plan_plan', sql`${t.plan} in ('starter','growth','pro')`),
    check('store_plan_interval', sql`${t.interval} in ('month','year')`),
    check(
      'store_plan_status',
      sql`${t.status} in ('trialing','active','due','paused','cancelled')`,
    ),
  ],
)

export const PLAN_PAYMENT_STATUSES = ['due', 'paid', 'cancelled'] as const
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
export const APP_PURCHASE_STATUSES = ['due', 'active', 'cancelled'] as const
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
