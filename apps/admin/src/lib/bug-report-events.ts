/**
 * "Report a bug" lives once in the admin frame (BugReportHost); the account menu opens it by
 * firing this event. Browser only.
 */
export const OPEN_BUG_REPORT_EVENT = 'admin:open-bug-report'

export function openBugReport(): void {
  window.dispatchEvent(new Event(OPEN_BUG_REPORT_EVENT))
}
