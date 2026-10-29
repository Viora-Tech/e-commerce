/** SOURCE OF TRUTH: bug report statuses — WHAT: the five states a "Report a bug" report moves through (received, in progress, fixed in the next update, live, won't fix) and what one report looks like to the admin / WHY: one list for the database check, the GitHub sync, My reports and the platform console; pure and client-safe */
import type { BugReportStatus } from '@commerce/db'

export type { BugReportStatus }

/** In the order a report moves through them; `wont_fix` is the other way out. */
export const BUG_REPORT_STATUSES = [
  'received',
  'in_progress',
  'fixed',
  'live',
  'wont_fix',
] as const satisfies readonly BugReportStatus[]

/** A report still waiting on the team (the worker's poll and the "live" check read these). */
export const OPEN_BUG_REPORT_STATUSES = [
  'received',
  'in_progress',
  'fixed',
] as const satisfies readonly BugReportStatus[]

/** Statuses the reporter is told about in the activity bell (and by email when they opted in). */
export const NOTIFY_BUG_REPORT_STATUSES = [
  'fixed',
  'live',
] as const satisfies readonly BugReportStatus[]

/** One report as My reports and the platform console list it. */
export type BugReportView = {
  id: string
  storeId: string
  title: string
  description: string
  page: string
  screenshotUrl: string | null
  status: BugReportStatus
  staffReply: string | null
  staffReplyAt: string | null
  githubIssueNumber: number | null
  reporterName: string
  reporterEmail: string
  /** True for the signed-in member's own report. */
  mine: boolean
  /** Changed since the reporter last opened My reports. */
  unread: boolean
  createdAt: string
  statusChangedAt: string
}
