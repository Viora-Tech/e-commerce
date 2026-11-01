import { ORPCError } from '@orpc/client'

/**
 * Bridges the non-React api-client interceptor and the React step-up dialog (A5). When a sensitive
 * call is refused with `STEP_UP_REQUIRED`, the interceptor asks the mounted dialog to re-verify the
 * session, then retries the call once. This module holds the one opener the dialog registers.
 */

/** The code the store guard throws (mirrors `STEP_UP_REQUIRED` in `packages/api/.../store.ts`). */
const STEP_UP_REQUIRED = 'STEP_UP_REQUIRED'

/** True when a call was refused because the session must step up before a sensitive action. */
export function isStepUpRequired(err: unknown): boolean {
  return err instanceof ORPCError && err.code === STEP_UP_REQUIRED
}

/** Runs the dialog; resolves true once the session re-verified, false on cancel. */
type StepUpOpener = () => Promise<boolean>

let opener: StepUpOpener | null = null
let pending: Promise<boolean> | null = null

/** The mounted dialog registers how to open itself here, and clears it on unmount. */
export function setStepUpOpener(next: StepUpOpener | null): void {
  opener = next
}

/**
 * Ask the mounted step-up dialog to re-verify the session. Several sensitive calls refused at once
 * share one dialog (one `pending` promise). Resolves false — so the caller rethrows the original
 * error — when no dialog is mounted or the member cancels.
 */
export function requestStepUp(): Promise<boolean> {
  if (!opener) return Promise.resolve(false)
  if (!pending) {
    pending = opener().finally(() => {
      pending = null
    })
  }
  return pending
}
