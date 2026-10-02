import { sql } from 'drizzle-orm'
import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { newId, store } from './schema'

/**
 * The AI engine's per-store tables (`@commerce/ai`, Settings → AI). Both are tenant tables
 * under forced RLS like every other.
 *
 * `ai_settings` is one row per store, created on first read: the store's AI plan (set by
 * the platform, never by the merchant's API) and which AI features the store has turned
 * off. A missing feature key means on.
 *
 * `ai_usage` meters AI per store, per calendar month in India (`YYYY-MM`) and per feature:
 * calls and tokens. The monthly quota is checked against the sum of a month's rows before
 * each call; prompts and answers are never stored.
 */

const AI_PLAN_VALUES = ['free', 'starter', 'growth', 'unlimited'] as const

export const aiSettings = pgTable(
  'ai_settings',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    plan: text('plan').$type<(typeof AI_PLAN_VALUES)[number]>().notNull().default('starter'),
    /** `{ productWriter?: boolean, askStore?: boolean }`; see @commerce/ai parseFeatureToggles. */
    features: jsonb('features').notNull().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('ai_settings_store').on(t.storeId),
    check('ai_settings_plan_check', sql`${t.plan} in ('free', 'starter', 'growth', 'unlimited')`),
  ],
)

export const aiUsage = pgTable(
  'ai_usage',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    /** Calendar month in India, `YYYY-MM`. */
    month: text('month').notNull(),
    /** An AI feature id from @commerce/ai (`productWriter`, `askStore`). */
    feature: text('feature').notNull(),
    calls: integer('calls').notNull().default(0),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('ai_usage_store_month_feature').on(t.storeId, t.month, t.feature)],
)
