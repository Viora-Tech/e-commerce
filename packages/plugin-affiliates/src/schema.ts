import { customer, newId, order, store } from '@commerce/db'
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Tables owned by the Affiliates app. They live in the platform's single migration chain
 * (packages/db/drizzle, 0158) and carry `store_id`, so `apply_store_rls()` isolates them like
 * core tables. The program itself is in `store.apps.settings.affiliates` (./settings).
 */

/**
 * One affiliate: a storefront customer who applied (or the merchant added). `code` is the
 * `?ref=` value and, upper-cased, their coupon. Payout details are one `encryptSecret` blob,
 * never stored or logged in the clear; `payoutHint` is the masked line the admin shows.
 */
export const affiliate = pgTable(
  'affiliate',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    customerId: uuid('customer_id').references(() => customer.id, { onDelete: 'set null' }),
    code: text('code').notNull(),
    name: text('name').notNull().default(''),
    email: text('email'),
    /** `phoneBlindIndex` of the last ten digits, for the self-referral check only. */
    phoneIndex: text('phone_index'),
    status: text('status', { enum: ['pending', 'approved', 'rejected', 'suspended'] })
      .notNull()
      .default('pending'),
    /** Where they post (Instagram handle, YouTube channel), from the application. */
    social: text('social').notNull().default(''),
    /** What they wrote when applying. */
    message: text('message').notNull().default(''),
    /** The merchant's private note. */
    note: text('note').notNull().default(''),
    /** The personal discount made for them, and its code. */
    discountId: uuid('discount_id'),
    couponCode: text('coupon_code'),
    payoutMethod: text('payout_method', { enum: ['upi', 'bank'] }),
    payoutDetails: text('payout_details'),
    payoutHint: text('payout_hint'),
    hasPan: boolean('has_pan').notNull().default(false),
    clicks: integer('clicks').notNull().default(0),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('affiliate_store_code').on(t.storeId, t.code),
    uniqueIndex('affiliate_store_customer').on(t.storeId, t.customerId),
    index('affiliate_store_status').on(t.storeId, t.status),
  ],
)

/**
 * A payout: approved commissions grouped for one affiliate, marked paid by the merchant after
 * paying outside the platform (UPI or a bank bulk upload). No money moves here.
 */
export const affiliatePayout = pgTable(
  'affiliate_payout',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    affiliateId: uuid('affiliate_id')
      .notNull()
      .references(() => affiliate.id),
    grossPaise: integer('gross_paise').notNull(),
    tdsPaise: integer('tds_paise').notNull().default(0),
    /** Clawbacks of earlier paid commissions taken off this payout. */
    clawbackPaise: integer('clawback_paise').notNull().default(0),
    netPaise: integer('net_paise').notNull(),
    status: text('status', { enum: ['pending', 'paid'] })
      .notNull()
      .default('pending'),
    /** UTR or the merchant's own reference, from "Mark paid". */
    reference: text('reference').notNull().default(''),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('affiliate_payout_store_status').on(t.storeId, t.status, t.createdAt)],
)

/**
 * The commission on one order (at most one per order). `basePaise` is the net sale it is on;
 * `tdsPaise` is set when it is approved. `flag` holds a fraud finding that keeps it from
 * being approved until the merchant decides.
 */
export const affiliateCommission = pgTable(
  'affiliate_commission',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    affiliateId: uuid('affiliate_id')
      .notNull()
      .references(() => affiliate.id),
    orderId: uuid('order_id')
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id'),
    source: text('source', { enum: ['link', 'coupon', 'lifetime'] }).notNull(),
    status: text('status', { enum: ['pending', 'approved', 'paid', 'reversed'] })
      .notNull()
      .default('pending'),
    basePaise: integer('base_paise').notNull(),
    /** What the order earned when it was placed; `commissionPaise` shrinks with partial refunds. */
    earnedPaise: integer('earned_paise').notNull(),
    commissionPaise: integer('commission_paise').notNull(),
    tdsPaise: integer('tds_paise').notNull().default(0),
    flag: text('flag'),
    placedAt: timestamp('placed_at', { withTimezone: true }).notNull(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    eligibleAt: timestamp('eligible_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
    reversedReason: text('reversed_reason'),
    payoutId: uuid('payout_id').references(() => affiliatePayout.id),
    /**
     * Money to win back: the commission was already in a payout when its order was refunded,
     * cancelled or returned. The affiliate's next payout is lowered by it.
     */
    clawbackPaise: integer('clawback_paise').notNull().default(0),
    /** The payout that recovered the clawback. */
    clawbackPayoutId: uuid('clawback_payout_id').references(() => affiliatePayout.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('affiliate_commission_store_order').on(t.storeId, t.orderId),
    index('affiliate_commission_store_affiliate').on(t.storeId, t.affiliateId, t.status),
    index('affiliate_commission_store_due').on(t.storeId, t.status, t.eligibleAt),
    index('affiliate_commission_store_customer').on(t.storeId, t.customerId),
  ],
)
