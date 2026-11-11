import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { customer, giftCard, newId, order, store } from './schema'

/*
 * Store credit: a real per-customer balance (not a gift card code). The account holds the
 * balance; every change is one ledger entry with what it was, why, who and for which order.
 */

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

/**
 * Why the balance moved: staff added or removed it, an order was paid with it, a refund went to it,
 * credit held for a checkout came back because the order was cancelled before it was paid, or
 * what was left of a credit with an expiry date ran out on that date.
 */
export const STORE_CREDIT_KINDS = ['adjustment', 'payment', 'refund', 'release', 'expiry'] as const

/** One customer's store credit balance, in paise. Never below zero. */
export const storeCreditAccount = pgTable(
  'store_credit_account',
  {
    id: id(),
    storeId: storeId(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customer.id, { onDelete: 'cascade' }),
    balancePaise: integer('balance_paise').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('store_credit_account_customer').on(t.storeId, t.customerId),
    check('store_credit_account_balance', sql`${t.balancePaise} >= 0`),
  ],
)

/**
 * One change to a balance: a credit (positive) or a debit (negative), the balance after it,
 * the reason in words, the staff member who made it (null for the system), and the order.
 */
export const storeCreditEntry = pgTable(
  'store_credit_entry',
  {
    id: id(),
    storeId: storeId(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customer.id, { onDelete: 'cascade' }),
    amountPaise: integer('amount_paise').notNull(),
    balanceAfterPaise: integer('balance_after_paise').notNull(),
    kind: text('kind', { enum: STORE_CREDIT_KINDS }).notNull(),
    reason: text('reason').notNull(),
    /** The admin member (auth user id) who made it; null for one the system made. */
    staffUserId: text('staff_user_id'),
    /** Their sign-in email at the time, shown in the history. */
    staffEmail: text('staff_email'),
    orderId: uuid('order_id').references(() => order.id, { onDelete: 'set null' }),
    /** A credit line that runs out: what is left of it leaves the balance then. Null never expires. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    /** On an `expiry` line: the credit line whose remainder it took off. One per credit line. */
    expiredEntryId: uuid('expired_entry_id').references((): AnyPgColumn => storeCreditEntry.id),
    /** On a line that moved an old store-credit gift card into the balance: that card. Once per card. */
    giftCardId: uuid('gift_card_id').references(() => giftCard.id),
    createdAt: createdAt(),
  },
  (t) => [
    index('store_credit_entry_customer').on(t.customerId, t.createdAt),
    uniqueIndex('store_credit_entry_expired_once')
      .on(t.expiredEntryId)
      .where(sql`${t.expiredEntryId} is not null`),
    uniqueIndex('store_credit_entry_gift_card_once')
      .on(t.giftCardId)
      .where(sql`${t.giftCardId} is not null`),
    index('store_credit_entry_expires')
      .on(t.expiresAt)
      .where(sql`${t.expiresAt} is not null`),
    check('store_credit_entry_nonzero', sql`${t.amountPaise} <> 0`),
    check(
      'store_credit_entry_kind_check',
      sql`${t.kind} in ('adjustment', 'payment', 'refund', 'release', 'expiry')`,
    ),
    check('store_credit_entry_expiry_credit', sql`${t.expiresAt} is null or ${t.amountPaise} > 0`),
  ],
)
