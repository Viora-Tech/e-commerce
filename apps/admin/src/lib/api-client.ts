'use client'

import { createApiClient } from '@commerce/api/client'
import { approvalsContent } from '@/data/approvals'
import { validationContent } from '@/data/common'
import { withReadableValidation } from '@/lib/api-errors'
import { localize } from '@/lib/copy'
import { localeFromCookieHeader } from '@/lib/i18n'
import { isStepUpRequired, requestStepUp } from '@/lib/step-up-gate'

/**
 * "Input validation failed" says nothing; name the field and why, in the member's language. A
 * change the member's role sends for approval comes back as APPROVAL_QUEUED: every page shows
 * the caught error's message, so it says plainly that it was sent for approval (or that the
 * same change was already waiting, so nothing new was sent).
 */
function readable(err: unknown): unknown {
  const cookie = typeof document === 'undefined' ? '' : document.cookie
  const locale = localeFromCookieHeader(cookie)
  if (err instanceof Error && (err as { code?: unknown }).code === 'APPROVAL_QUEUED') {
    const copy = localize(approvalsContent, locale)
    const data = (err as { data?: { alreadyRequested?: boolean } }).data
    err.message = data?.alreadyRequested ? copy.already : copy.sent
    return err
  }
  return withReadableValidation(err, localize(validationContent, locale))
}

// RPCLink needs an absolute URL; resolve against the page origin in the browser.
const base = typeof window === 'undefined' ? 'http://localhost:3200' : window.location.origin
export const api = createApiClient(`${base}/api/rpc`, undefined, [
  async ({ next }) => {
    try {
      return await next()
    } catch (err) {
      // A sensitive action refused for a stale session (A5): re-verify in the step-up dialog,
      // then retry the call once. When no dialog is mounted or the member cancels, fall through
      // to the original error.
      if (isStepUpRequired(err) && (await requestStepUp())) {
        try {
          return await next()
        } catch (retryErr) {
          throw readable(retryErr)
        }
      }
      throw readable(err)
    }
  },
])
