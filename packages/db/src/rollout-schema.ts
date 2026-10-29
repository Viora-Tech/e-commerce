import { sql } from 'drizzle-orm'
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { store } from './schema'

/*
 * Rollouts (0184): Shopify Markets → Rollouts. A set of store changes (the live theme, the
 * checkout branding, discounts on or off) that go live at a set time, for good (launch) or for
 * a period that rolls back by itself (event). Design: docs/superpowers/specs/2026-10-28-rollouts-r1-design.md.
 */

const id = () =>
  uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7())
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
/** A check constraint's `in (...)` list, from the same array the column's enum uses. */
const oneOf = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(', '))

/** Launch: the changes stay. Event: they run between two times, then roll back or stay. */
export const ROLLOUT_KINDS = ['launch', 'event'] as const
export type RolloutKind = (typeof ROLLOUT_KINDS)[number]

/**
 * Draft (no start or no changes) → scheduled → active → ended; an active event can be paused
 * (rolled back early) and resumed. Archived rollouts are kept only for the record.
 */
export const ROLLOUT_STATUSES = [
  'draft',
  'scheduled',
  'active',
  'paused',
  'ended',
  'archived',
] as const
export type RolloutStatus = (typeof ROLLOUT_STATUSES)[number]

/** What an event does when it ends: restore what was there, or keep its changes. */
export const ROLLOUT_END_ACTIONS = ['rollback', 'apply'] as const
export type RolloutEndAction = (typeof ROLLOUT_END_ACTIONS)[number]

/** The live theme, the checkout branding, or one discount's status. */
const ROLLOUT_CHANGE_KINDS = ['theme', 'checkout_branding', 'discount'] as const
export type RolloutChangeKind = (typeof ROLLOUT_CHANGE_KINDS)[number]

/**
 * SOURCE OF TRUTH: rollout, rolloutChange
 * WHAT:  A scheduled set of store changes and each change: what it sets (`target`, `value`) and,
 *        once applied, what it replaced (`previous`), so an event can put it back.
 * WHY:   A sale prepared ahead goes live at midnight with nobody clicking, and ends exactly
 *        where the store was. The worker's tick starts and ends due rollouts.
 */
export const rollout = pgTable(
  'rollout',
  {
    id: id(),
    storeId: storeId(),
    name: text('name').notNull(),
    kind: text('kind', { enum: ROLLOUT_KINDS }).notNull().default('launch'),
    status: text('status', { enum: ROLLOUT_STATUSES }).notNull().default('draft'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    /** Events only: when it ends (required for an event). */
    endsAt: timestamp('ends_at', { withTimezone: true }),
    endAction: text('end_action', { enum: ROLLOUT_END_ACTIONS }).notNull().default('rollback'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    /** Why the last start or end failed (a theme deleted meanwhile); null when it went through. */
    error: text('error'),
    createdBy: text('created_by'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The worker's tick: rollouts due to start or end.
    index('rollout_due').on(t.status, t.startsAt, t.endsAt),
    index('rollout_store').on(t.storeId, t.status),
    check('rollout_kind', sql`${t.kind} in (${oneOf(ROLLOUT_KINDS)})`),
    check('rollout_status', sql`${t.status} in (${oneOf(ROLLOUT_STATUSES)})`),
    check('rollout_end_action', sql`${t.endAction} in (${oneOf(ROLLOUT_END_ACTIONS)})`),
    check(
      'rollout_event_end',
      sql`${t.kind} <> 'event' or ${t.endsAt} is null or ${t.startsAt} is null or ${t.endsAt} > ${t.startsAt}`,
    ),
  ],
)

export const rolloutChange = pgTable(
  'rollout_change',
  {
    id: id(),
    storeId: storeId(),
    rolloutId: uuid('rollout_id')
      .notNull()
      .references(() => rollout.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ROLLOUT_CHANGE_KINDS }).notNull(),
    /** The theme to publish or the discount to switch; null for the checkout branding. */
    targetId: uuid('target_id'),
    /** Checkout branding to set, or `{ "status": "active" | "disabled" }` for a discount. */
    value: jsonb('value').notNull().default({}),
    /** Filled when applied: the live theme id, the branding, or the discount's status it replaced. */
    previous: jsonb('previous'),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('rollout_change_rollout').on(t.rolloutId),
    // Conflict checks: which rollouts touch this theme or discount.
    index('rollout_change_target').on(t.storeId, t.kind, t.targetId),
    uniqueIndex('rollout_change_one_branding')
      .on(t.rolloutId)
      .where(sql`${t.kind} = 'checkout_branding'`),
    uniqueIndex('rollout_change_one_theme').on(t.rolloutId).where(sql`${t.kind} = 'theme'`),
    uniqueIndex('rollout_change_discount_once')
      .on(t.rolloutId, t.targetId)
      .where(sql`${t.kind} = 'discount'`),
    check('rollout_change_kind', sql`${t.kind} in (${oneOf(ROLLOUT_CHANGE_KINDS)})`),
    check(
      'rollout_change_target',
      sql`(${t.kind} = 'checkout_branding') = (${t.targetId} is null)`,
    ),
  ],
)
