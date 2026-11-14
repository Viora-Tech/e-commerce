'use client'

import { useEffect } from 'react'
import PageBody from '@/components/layout/page-body'
import PageState from '@/components/states/page-state'
import { reportBrowserError } from '@/lib/browser-errors'
import { isForbidden } from '@/lib/forbidden'

type RouteErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Shared body for every `error.tsx`: what went wrong, one retry. A read the member's role does
 * not allow (the API's FORBIDDEN) says "You do not have access" instead, with no retry.
 */
export default function RouteError({ error, reset }: RouteErrorProps) {
  // Hooks
  useEffect(() => {
    console.error(error)
    // A boundary catches the error before `window.onerror` could see it, so report it here;
    // one with a digest came from the server, which already reported it.
    if (!error.digest && !isForbidden(error)) reportBrowserError(error)
  }, [error])

  // Render logic
  const forbidden = isForbidden(error)

  return (
    <PageBody>
      {forbidden ? (
        <PageState kind="no-access" />
      ) : (
        <PageState kind="error" body={error.message || undefined} onRetry={reset} />
      )}
    </PageBody>
  )
}
