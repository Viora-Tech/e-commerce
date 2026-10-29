/** SOURCE OF TRUTH: bug report records — WHAT: stores each "Report a bug" report beside its GitHub issue, lists a member's own reports (or the store's, for owners) with an unread mark, and applies status and reply changes from GitHub with the reporter's email / WHY: reports hold customer details, so the reporter follows their report here instead of on a public GitHub repo */
import { bugReport, type StoreTx, store } from '@commerce/db'
import { and, desc, eq, gt, inArray, isNotNull, sql } from 'drizzle-orm'
import { loadMemberAlertPrefs } from '../member-account/alerts'
import { memberAccess } from '../permissions/service'
import { getPlatformEmail, type PlatformEmail } from '../sender-email/platform'
import {
  type BugReportStatus,
  type BugReportView,
  NOTIFY_BUG_REPORT_STATUSES,
  OPEN_BUG_REPORT_STATUSES,
} from './client'

/** Most reports one list returns. */
const BUG_REPORT_LIST_MAX = 100

export type NewBugReport = {
  reporterUserId: string
  reporterEmail: string
  reporterName: string
  title: string
  description: string
  page: string
  screenshotUrl: string | null
  githubIssueNumber: number | null
  githubIssueUrl: string | null
}

/** Saves a report as it was filed (the router calls it right after the GitHub issue exists). */
export async function recordBugReport(
  tx: StoreTx,
  storeId: string,
  input: NewBugReport,
): Promise<string> {
  const [row] = await tx
    .insert(bugReport)
    .values({ storeId, ...input })
    .returning({ id: bugReport.id })
  if (!row) throw new Error('bug report insert returned nothing')
  return row.id
}

type Row = typeof bugReport.$inferSelect

/** The reporter has not seen this change yet. A fresh report (nothing changed) is never unread. */
function isUnread(r: Pick<Row, 'statusChangedAt' | 'reporterSeenAt' | 'createdAt'>): boolean {
  return r.statusChangedAt > (r.reporterSeenAt ?? r.createdAt)
}

function toBugReportView(r: Row, userId: string | null): BugReportView {
  const mine = userId !== null && r.reporterUserId === userId
  return {
    id: r.id,
    storeId: r.storeId,
    title: r.title,
    description: r.description,
    page: r.page,
    screenshotUrl: r.screenshotUrl,
    status: r.status,
    staffReply: r.staffReply,
    staffReplyAt: r.staffReplyAt?.toISOString() ?? null,
    githubIssueNumber: r.githubIssueNumber,
    reporterName: r.reporterName,
    reporterEmail: r.reporterEmail,
    mine,
    unread: mine && isUnread(r),
    createdAt: r.createdAt.toISOString(),
    statusChangedAt: r.statusChangedAt.toISOString(),
  }
}

/**
 * My reports: the member's own reports in this store, newest first, or with `scope: 'store'`
 * every report filed in the store (the router only allows that for the owner).
 */
export async function listBugReports(
  tx: StoreTx,
  input: { userId: string; scope: 'mine' | 'store' },
): Promise<BugReportView[]> {
  const rows = await tx
    .select()
    .from(bugReport)
    .where(input.scope === 'mine' ? eq(bugReport.reporterUserId, input.userId) : undefined)
    .orderBy(desc(bugReport.createdAt))
    .limit(BUG_REPORT_LIST_MAX)
  return rows.map((r) => toBugReportView(r, input.userId))
}

/** How many of the member's reports changed since they last opened My reports (the menu's dot). */
export async function countUnreadBugReports(tx: StoreTx, userId: string): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(bugReport)
    .where(
      and(
        eq(bugReport.reporterUserId, userId),
        gt(
          bugReport.statusChangedAt,
          sql`coalesce(${bugReport.reporterSeenAt}, ${bugReport.createdAt})`,
        ),
      ),
    )
  return row?.n ?? 0
}

/** Opening My reports marks every one of the member's reports as seen. */
export async function markBugReportsSeen(tx: StoreTx, userId: string): Promise<void> {
  await tx
    .update(bugReport)
    .set({ reporterSeenAt: new Date() })
    .where(eq(bugReport.reporterUserId, userId))
}

/** The member's reports that turned fixed or live in the last `days`, for the activity bell. */
export async function recentlyFixedBugReports(
  tx: StoreTx,
  userId: string,
  since: Date,
): Promise<{ id: string; title: string; status: BugReportStatus; at: string }[]> {
  const rows = await tx
    .select({
      id: bugReport.id,
      title: bugReport.title,
      status: bugReport.status,
      at: bugReport.statusChangedAt,
    })
    .from(bugReport)
    .where(
      and(
        eq(bugReport.reporterUserId, userId),
        inArray(bugReport.status, [...NOTIFY_BUG_REPORT_STATUSES]),
        gt(bugReport.statusChangedAt, since),
      ),
    )
    .orderBy(desc(bugReport.statusChangedAt))
    .limit(10)
  return rows.map((r) => ({ ...r, at: r.at.toISOString() }))
}

/** Reports filed as one GitHub issue (normally one row; the store's RLS scopes it). */
export async function bugReportsForIssue(tx: StoreTx, issue: number): Promise<Row[]> {
  return tx.select().from(bugReport).where(eq(bugReport.githubIssueNumber, issue))
}

/** Reports whose GitHub issue may still change, least recently synced first. */
export async function openBugReports(
  tx: StoreTx,
  opts: { syncedBefore?: Date; status?: BugReportStatus[]; limit: number },
): Promise<Row[]> {
  return tx
    .select()
    .from(bugReport)
    .where(
      and(
        isNotNull(bugReport.githubIssueNumber),
        inArray(bugReport.status, opts.status ?? [...OPEN_BUG_REPORT_STATUSES]),
        opts.syncedBefore
          ? sql`(${bugReport.syncedAt} is null or ${bugReport.syncedAt} < ${opts.syncedBefore.toISOString()}::timestamptz)`
          : undefined,
      ),
    )
    .orderBy(sql`${bugReport.syncedAt} asc nulls first`, bugReport.createdAt)
    .limit(opts.limit)
}

export type BugReportPatch = {
  status?: BugReportStatus
  closedAt?: Date | null
  liveAt?: Date | null
  fixCommitSha?: string | null
  staffReply?: string | null
  staffReplyAt?: Date | null
  staffReplyCommentId?: string | null
}

/**
 * Writes a change to one report. A new status or reply moves `status_changed_at` (the unread
 * dot and the bell read it); the sync time is always stamped. Returns the row after the change.
 */
export async function patchBugReport(
  tx: StoreTx,
  id: string,
  patch: BugReportPatch,
  now = new Date(),
): Promise<Row | null> {
  const visible = patch.status !== undefined || patch.staffReply !== undefined
  const [row] = await tx
    .update(bugReport)
    .set({
      ...patch,
      ...(visible ? { statusChangedAt: now } : {}),
      syncedAt: now,
      updatedAt: now,
    })
    .where(eq(bugReport.id, id))
    .returning()
  return row ?? null
}

/** The store's name, for the reporter's email. */
async function bugReportStoreName(tx: StoreTx, storeId: string): Promise<string> {
  const [row] = await tx.select({ name: store.name }).from(store).where(eq(store.id, storeId))
  return row?.name ?? 'Unknown store'
}

export type BugReportEmailOptions = {
  /** `ADMIN_URL`, for the "See my reports" button. */
  adminUrl: string
  platform?: Pick<PlatformEmail, 'transport'>
}

/**
 * Emails the reporter that their report is fixed or live, through the platform email account,
 * only when they keep "Your bug reports" email on in Account → Notifications for this store (on
 * by default) and are still a member. Best effort: false when nothing went.
 */
export async function emailBugReportUpdate(
  tx: StoreTx,
  report: Pick<Row, 'storeId' | 'reporterUserId' | 'reporterEmail' | 'title' | 'status'>,
  opts: BugReportEmailOptions,
): Promise<boolean> {
  if (report.status !== 'fixed' && report.status !== 'live') return false
  const access = await memberAccess(tx, report.storeId, report.reporterUserId)
  if (!access) return false
  const prefs = await loadMemberAlertPrefs(
    tx,
    report.storeId,
    report.reporterUserId,
    access.isOwner,
  )
  if (!prefs.bugReports.email) return false
  const transport = (opts.platform ?? getPlatformEmail()).transport
  if (!transport) return false
  const channel = transport.channel({
    fromEmail: transport.fromEmail,
    fromName: transport.fromName,
    replyTo: undefined,
    using: 'platform',
  })
  const storeName = await bugReportStoreName(tx, report.storeId)
  const r = await channel.send({
    to: { email: report.reporterEmail },
    template: 'bug_report_update',
    data: {
      customerName: '',
      totalLabel: '',
      lines: [],
      paymentMethodLabel: '',
      storeName,
      bugReport: { title: report.title, status: report.status },
      actionUrl: `${opts.adminUrl.replace(/\/+$/, '')}/account/bug-reports`,
    },
  })
  return r.ok
}
