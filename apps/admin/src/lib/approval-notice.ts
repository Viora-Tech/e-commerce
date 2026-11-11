/**
 * SOURCE OF TRUTH: the "Sent for approval" notice.
 * WHAT: when a member's role sends a change for approval, the API answers APPROVAL_QUEUED. The
 *       API client calls `showApprovalNotice` once, and the page's own error toast that follows
 *       within a moment (most pages show "Could not save" for any failed call) is held back, so
 *       the member sees one notice that the change is waiting in Settings → Approvals.
 * WHY:  an Admin turning COD off saw "Could not switch. Try again." although the change had been
 *       sent for approval (owner, 11 Nov 2026); 73 admin screens show a fixed failure message,
 *       so the fix lives here rather than in each of them.
 */
import { toast } from 'sonner'

const NOTICE_ID = 'approval-queued'
/** How long after the notice a page's failure toast counts as part of the same call. */
const HOLD_MS = 2000

let shownAt = 0

const showError = toast.error
toast.error = ((message, data) =>
  Date.now() - shownAt < HOLD_MS ? NOTICE_ID : showError(message, data)) as typeof toast.error

/** The sentences shown so far, so a form that keeps the caught message can tell it apart (#1531). */
const noticeMessages = new Set<string>()

/** Shows the notice and holds back the page's failure toast for the same call. */
export function showApprovalNotice(message: string): void {
  shownAt = Date.now()
  noticeMessages.add(message)
  toast.info(message, { id: NOTICE_ID })
}

/**
 * True when a form's stored save error is really the "Sent for approval" sentence: most forms
 * keep `err.message` as a string, so `SaveErrorAlert` asks this before drawing a red alert.
 */
export function isApprovalNotice(message: string | null | undefined): boolean {
  return Boolean(message) && noticeMessages.has(message as string)
}
