import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { newId, store } from './schema'

/*
 * "Report a bug" (test server only): every report a member files, kept beside its GitHub issue so
 * the reporter can see what happened to it (Account → My reports) without a public issues repo
 * (reports can hold customer details). GitHub stays the team's workspace; the webhook and the
 * worker's poll copy the issue's state and the team's latest public reply back here.
 */

/** received → in_progress → fixed (merged into dev) → live (released to main); or wont_fix. */
export const BUG_REPORT_STATUSES = ['received', 'in_progress', 'fixed', 'live', 'wont_fix'] as const
export type BugReportStatus = (typeof BUG_REPORT_STATUSES)[number]

const at = (name: string) => timestamp(name, { withTimezone: true })

export const bugReport = pgTable(
  'bug_report',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    /** Better Auth user id of the member who filed it. */
    reporterUserId: text('reporter_user_id').notNull(),
    reporterEmail: text('reporter_email').notNull(),
    reporterName: text('reporter_name').notNull().default(''),
    /** What went wrong (already scrubbed of secrets, as sent to GitHub). */
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    /** The admin path the member was on. */
    page: text('page').notNull().default(''),
    screenshotUrl: text('screenshot_url'),
    /** Null while no GitHub token is set (development logs the report instead). */
    githubIssueNumber: integer('github_issue_number'),
    githubIssueUrl: text('github_issue_url'),
    status: text('status').$type<BugReportStatus>().notNull().default('received'),
    /** The team's latest public reply on the issue (secrets scrubbed); `internal:` comments never land here. */
    staffReply: text('staff_reply'),
    staffReplyAt: at('staff_reply_at'),
    /** GitHub comment id the reply came from, so deleting that comment clears it. */
    staffReplyCommentId: text('staff_reply_comment_id'),
    /** The commit that closed the issue (the fix PR's merge into dev), for the "live" check. */
    fixCommitSha: text('fix_commit_sha'),
    closedAt: at('closed_at'),
    liveAt: at('live_at'),
    /** When `status` or `staff_reply` last changed: the reporter's unread dot compares it with `reporter_seen_at`. */
    statusChangedAt: at('status_changed_at').notNull().defaultNow(),
    reporterSeenAt: at('reporter_seen_at'),
    /** Last time the webhook or the worker's poll read the issue. */
    syncedAt: at('synced_at'),
    createdAt: at('created_at').notNull().defaultNow(),
    updatedAt: at('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('bug_report_reporter').on(t.storeId, t.reporterUserId, t.createdAt),
    index('bug_report_store_created').on(t.storeId, t.createdAt),
    index('bug_report_issue').on(t.githubIssueNumber),
    check(
      'bug_report_status_check',
      sql`${t.status} in ('received','in_progress','fixed','live','wont_fix')`,
    ),
  ],
)
