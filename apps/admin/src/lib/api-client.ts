'use client'

import { createApiClient } from '@commerce/api/client'
import { validationContent } from '@/data/common'
import { withReadableValidation } from '@/lib/api-errors'
import { localize } from '@/lib/copy'
import { localeFromCookieHeader } from '@/lib/i18n'

/** "Input validation failed" says nothing; name the field and why, in the member's language. */
function readable(err: unknown): unknown {
  const cookie = typeof document === 'undefined' ? '' : document.cookie
  return withReadableValidation(err, localize(validationContent, localeFromCookieHeader(cookie)))
}

// RPCLink needs an absolute URL; resolve against the page origin in the browser.
const base = typeof window === 'undefined' ? 'http://localhost:3200' : window.location.origin
export const api = createApiClient(`${base}/api/rpc`, undefined, [
  async ({ next }) => {
    try {
      return await next()
    } catch (err) {
      throw readable(err)
    }
  },
])
