import { sql } from 'drizzle-orm'
import { check, date, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { newId, store } from './schema'

/*
 * The store's running costs (Settings › Monthly expenses), taken off the month's order profit to
 * give net profit. Maths: @commerce/core finance/monthly-expenses.ts. Design:
 * docs/superpowers/specs/2026-10-22-profit-design.md §3.
 */

/** What an expense is for. Same list as EXPENSE_CATEGORIES in @commerce/core (a test checks). */
export const MONTHLY_EXPENSE_CATEGORIES = [
  'staff',
  'rent',
  'software',
  'marketing',
  'utilities',
  'services',
  'other',
] as const
export type MonthlyExpenseCategory = (typeof MONTHLY_EXPENSE_CATEGORIES)[number]

const oneOf = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(', '))

/**
 * One version of a monthly expense: it counts in every month from `starts_on` to `ends_on`
 * (first days of months; null = still running). Changing it from a later month ends this
 * version the month before and starts a new one in the same `series_id`, so past months keep
 * what they had. Deleting archives the whole series.
 */
export const monthlyExpense = pgTable(
  'monthly_expense',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    /** The first version's id; every later version of the same expense shares it. */
    seriesId: uuid('series_id').notNull(),
    name: text('name').notNull(),
    category: text('category', { enum: MONTHLY_EXPENSE_CATEGORIES }).notNull().default('other'),
    /** Per month: before GST for a GST-registered store (input credit), as paid otherwise. */
    amountPaise: integer('amount_paise').notNull(),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('monthly_expense_store_starts').on(t.storeId, t.startsOn),
    index('monthly_expense_series').on(t.seriesId),
    check(
      'monthly_expense_category_check',
      sql`${t.category} in (${oneOf(MONTHLY_EXPENSE_CATEGORIES)})`,
    ),
    check('monthly_expense_amount_check', sql`${t.amountPaise} >= 0`),
    check('monthly_expense_range_check', sql`${t.endsOn} is null or ${t.endsOn} >= ${t.startsOn}`),
  ],
)
