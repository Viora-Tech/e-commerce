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
import { newId, product, store } from './schema'

/**
 * The AI engine's per-store tables (`@commerce/ai`, Settings → AI). All are tenant tables
 * under forced RLS like every other.
 *
 * `ai_settings` is one row per store, created on first read: the store's AI plan (set by
 * the platform, never by the merchant's API), which AI features the store has turned off
 * (a missing feature key means on) and its writing quality (which model tier writes).
 *
 * `ai_usage` meters AI per store, per calendar month in India (`YYYY-MM`) and per feature:
 * calls and tokens. The monthly quota is checked against the sum of a month's rows before
 * each call; prompts and answers are never stored.
 *
 * `ai_action` is the AI assistant's audit log (AI v2): every change the assistant proposed,
 * who approved it, what ran and how to undo it. A row is written when the model proposes
 * (`proposed`); nothing in the store changes until the member approves it (`executed` or
 * `failed`), or it is `cancelled`, `expired` or later `undone`. Settings → AI → Activity
 * lists it. It holds the proposal (store data such as titles and prices), never the chat.
 *
 * `ai_job` and `ai_job_item` are bulk AI runs ("Write with AI" for many products), worked
 * through by the worker one product at a time with per-store fairness. Each item keeps its
 * suggestion until the merchant reviews and applies it.
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
    /** `{ productWriter?: boolean, assistant?: boolean, bulkWriter?: boolean }`; see @commerce/ai parseFeatureToggles. */
    features: jsonb('features').notNull().default({}),
    /** `standard` (fast model) or `best` (strong model for long writing); see @commerce/ai tierFor. */
    writingQuality: text('writing_quality')
      .$type<'standard' | 'best'>()
      .notNull()
      .default('standard'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('ai_settings_store').on(t.storeId),
    check('ai_settings_plan_check', sql`${t.plan} in ('free', 'starter', 'growth', 'unlimited')`),
    check('ai_settings_writing_quality_check', sql`${t.writingQuality} in ('standard', 'best')`),
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
    /** An AI feature id from @commerce/ai (`productWriter`, `assistant`, `bulkWriter`; older rows `askStore`). */
    feature: text('feature').notNull(),
    calls: integer('calls').notNull().default(0),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('ai_usage_store_month_feature').on(t.storeId, t.month, t.feature)],
)

const AI_ACTION_STATUSES = [
  'proposed',
  'executed',
  'failed',
  'cancelled',
  'expired',
  'undone',
] as const
export type AiActionStatus = (typeof AI_ACTION_STATUSES)[number]

export const aiAction = pgTable(
  'ai_action',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    /** The member whose message led to the proposal; only they can approve it. */
    userId: text('user_id').notNull(),
    /** `assistant` (the AI bar) or `bulkWriter` (applying a bulk AI run). */
    source: text('source').$type<'assistant' | 'bulkWriter'>().notNull().default('assistant'),
    /** The assistant tool, e.g. `proposeDiscount`. */
    tool: text('tool').notNull(),
    status: text('status').$type<AiActionStatus>().notNull().default('proposed'),
    /** One plain line, e.g. "Create discount DIWALI10: 10% off collection Mice". */
    summary: text('summary').notNull(),
    /** The checked tool input the action runs with (store ids resolved under RLS). */
    input: jsonb('input').notNull(),
    /** What the card shows: rows of before and after. */
    preview: jsonb('preview').notNull(),
    result: jsonb('result'),
    /** What undo needs (previous prices, the created discount's id); null when there is no undo. */
    undo: jsonb('undo'),
    error: text('error'),
    /** Proposed after the assistant read store text that looked like instructions to the AI. */
    flagged: boolean('flagged').notNull().default(false),
    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    undoneBy: text('undone_by'),
    undoneAt: timestamp('undone_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ai_action_store_created').on(t.storeId, t.createdAt),
    check(
      'ai_action_status_check',
      sql`${t.status} in ('proposed', 'executed', 'failed', 'cancelled', 'expired', 'undone')`,
    ),
    check('ai_action_source_check', sql`${t.source} in ('assistant', 'bulkWriter')`),
  ],
)

const AI_JOB_STATUSES = ['queued', 'running', 'done', 'failed', 'cancelled'] as const
export type AiJobStatus = (typeof AI_JOB_STATUSES)[number]

export const aiJob = pgTable(
  'ai_job',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    userId: text('user_id').notNull(),
    /** `productCopy`: descriptions, search text, tags and alt text for many products. */
    kind: text('kind').$type<'productCopy'>().notNull().default('productCopy'),
    status: text('status').$type<AiJobStatus>().notNull().default('queued'),
    /** `{ fields, language, tone, quality }`; see the API's bulk writer input. */
    options: jsonb('options').notNull(),
    total: integer('total').notNull().default(0),
    done: integer('done').notNull().default(0),
    failed: integer('failed').notNull().default(0),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ai_job_store_created').on(t.storeId, t.createdAt),
    check(
      'ai_job_status_check',
      sql`${t.status} in ('queued', 'running', 'done', 'failed', 'cancelled')`,
    ),
    check('ai_job_kind_check', sql`${t.kind} in ('productCopy')`),
  ],
)

const AI_JOB_ITEM_STATUSES = [
  'pending',
  'running',
  'ready',
  'failed',
  'applied',
  'skipped',
] as const
export type AiJobItemStatus = (typeof AI_JOB_ITEM_STATUSES)[number]

export const aiJobItem = pgTable(
  'ai_job_item',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    jobId: uuid('job_id')
      .notNull()
      .references(() => aiJob.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    status: text('status').$type<AiJobItemStatus>().notNull().default('pending'),
    /** The writer's clamped output (`ProductCopy` from @commerce/ai), once ready. */
    suggestion: jsonb('suggestion'),
    error: text('error'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('ai_job_item_job_product').on(t.jobId, t.productId),
    check(
      'ai_job_item_status_check',
      sql`${t.status} in ('pending', 'running', 'ready', 'failed', 'applied', 'skipped')`,
    ),
  ],
)
