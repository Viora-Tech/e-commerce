/**
 * "Report a bug" lives once in the admin frame (BugReportHost); the account menu opens it by
 * firing this event. Browser only.
 */
export const OPEN_BUG_REPORT_EVENT = 'admin:open-bug-report'

export function openBugReport(): void {
  window.dispatchEvent(new Event(OPEN_BUG_REPORT_EVENT))
}

/** My reports fires this once it marked the member's reports seen, so the menu's dot clears. */
export const BUG_REPORTS_SEEN_EVENT = 'admin:bug-reports-seen'

export function announceBugReportsSeen(): void {
  window.dispatchEvent(new Event(BUG_REPORTS_SEEN_EVENT))
}
