import { sql } from 'drizzle-orm'
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { newId, store } from './schema'

/*
 * Email addresses a store stops mailing because Amazon SES reported a bounce or a complaint
 * (an SNS notification to the worker, core `email-suppression`). Both tables carry `store_id`
 * and sit under RLS. Migration 0239.
 */

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)

/** Why an address is on the list. */
export type EmailSuppressionReason = 'hard_bounce' | 'soft_bounces' | 'complaint'

/**
 * One row per address a store has stopped mailing. `cleared_at` set means staff chose
 * "Allow again": sends resume, and only feedback after it counts towards a new suppression.
 * Emails are stored lower case.
 */
export const emailSuppression = pgTable(
  'email_suppression',
  {
    id: id(),
    storeId: storeId(),
    email: text('email').notNull(),
    reason: text('reason').$type<EmailSuppressionReason>().notNull(),
    /** The receiving server's words (`diagnosticCode`) or the complaint type, for staff. */
    detail: text('detail'),
    suppressedAt: timestamp('suppressed_at', { withTimezone: true }).notNull().defaultNow(),
    clearedAt: timestamp('cleared_at', { withTimezone: true }),
    /** Staff email of whoever allowed the address again. */
    clearedBy: text('cleared_by'),
  },
  (t) => [
    uniqueIndex('email_suppression_store_email').on(t.storeId, t.email),
    check(
      'email_suppression_reason',
      sql`${t.reason} in ('hard_bounce', 'soft_bounces', 'complaint')`,
    ),
  ],
)

/** What SES said about one recipient of one message. */
export type EmailFeedbackKind = 'bounce' | 'complaint'

/**
 * Every bounce and complaint SES reported, one row per recipient per SNS message. The unique
 * index on the SNS `MessageId` makes a redelivered notification a no-op; soft bounces are
 * counted from here.
 */
export const emailFeedbackEvent = pgTable(
  'email_feedback_event',
  {
    id: id(),
    storeId: storeId(),
    /** SNS `MessageId` of the notification. */
    snsMessageId: text('sns_message_id').notNull(),
    email: text('email').notNull(),
    kind: text('kind').$type<EmailFeedbackKind>().notNull(),
    /** SES `bounceType` (`Permanent`, `Transient`, `Undetermined`); null for a complaint. */
    bounceType: text('bounce_type'),
    /** SES `bounceSubType` or `complaintFeedbackType`. */
    subType: text('sub_type'),
    detail: text('detail'),
    /** SES message id of the email that bounced, to match the `notification` row. */
    sesMessageId: text('ses_message_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('email_feedback_event_message').on(t.storeId, t.snsMessageId, t.email),
    index('email_feedback_event_email').on(t.storeId, t.email, t.createdAt),
    check('email_feedback_event_kind', sql`${t.kind} in ('bounce', 'complaint')`),
  ],
)
