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
import { customer, newId, order, product, store } from './schema'
import { storeCreditEntry } from './store-credit-schema'

/*
 * Loyalty points app: why each point came or went. The points themselves are store credit
 * (1 point = ₹1, a `loyalty` line on the customer's balance); this ledger holds the reason, the
 * points still waiting for an order's return window, and the one-per-thing guarantees.
 */

/** Why points moved: an order earned them, a review, a birthday, staff, or an order taking them back. */
export const LOYALTY_SOURCES = ['order', 'review', 'birthday', 'adjustment', 'reversal'] as const

/** `pending`: waiting to be credited. `credited`: on the balance. `cancelled`: never credited. */
export const LOYALTY_STATUSES = ['pending', 'credited', 'cancelled'] as const

const at = (name: string) => timestamp(name, { withTimezone: true })

export const loyaltyEntry = pgTable(
  'loyalty_entry',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customer.id, { onDelete: 'cascade' }),
    source: text('source', { enum: LOYALTY_SOURCES }).notNull(),
    status: text('status', { enum: LOYALTY_STATUSES }).notNull(),
    /** Points, signed: a `reversal` or a staff removal is negative. Worked out again at credit time. */
    points: integer('points').notNull(),
    orderId: uuid('order_id').references(() => order.id, { onDelete: 'set null' }),
    /** For a `review`: the product reviewed (once per customer and product). */
    productId: uuid('product_id').references(() => product.id, { onDelete: 'set null' }),
    /** For a `birthday`: the year it was given (once per customer and year). */
    year: integer('year'),
    /** In words, for the admin's history. */
    reason: text('reason').notNull(),
    staffEmail: text('staff_email'),
    /** When a pending entry may be credited (an order's return window over). */
    availableAt: at('available_at').notNull().defaultNow(),
    creditedAt: at('credited_at'),
    /** The store credit line that carried the points. */
    storeCreditEntryId: uuid('store_credit_entry_id').references(() => storeCreditEntry.id),
    /** When these points run out (the store credit line's expiry); null never. */
    expiresAt: at('expires_at'),
    /** When the "points expiring soon" email went out for this entry. */
    remindedAt: at('reminded_at'),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('loyalty_entry_order_once')
      .on(t.storeId, t.orderId)
      .where(sql`${t.source} = 'order'`),
    uniqueIndex('loyalty_entry_review_once')
      .on(t.storeId, t.customerId, t.productId)
      .where(sql`${t.source} = 'review'`),
    uniqueIndex('loyalty_entry_birthday_once')
      .on(t.storeId, t.customerId, t.year)
      .where(sql`${t.source} = 'birthday'`),
    index('loyalty_entry_customer').on(t.storeId, t.customerId, t.createdAt),
    index('loyalty_entry_due').on(t.storeId, t.status, t.availableAt),
    check('loyalty_entry_points_nonzero', sql`${t.points} <> 0`),
    check(
      'loyalty_entry_source_check',
      sql`${t.source} in ('order', 'review', 'birthday', 'adjustment', 'reversal')`,
    ),
    check('loyalty_entry_status_check', sql`${t.status} in ('pending', 'credited', 'cancelled')`),
  ],
)
