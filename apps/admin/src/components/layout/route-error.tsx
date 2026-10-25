'use client'

import { useEffect } from 'react'
import PageBody from '@/components/layout/page-body'
import PageState from '@/components/states/page-state'
import { reportBrowserError } from '@/lib/browser-errors'

type RouteErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

/** Shared body for every `error.tsx`: what went wrong, one retry. */
export default function RouteError({ error, reset }: RouteErrorProps) {
  // Hooks
  useEffect(() => {
    console.error(error)
    // A boundary catches the error before `window.onerror` could see it, so report it here;
    // one with a digest came from the server, which already reported it.
    if (!error.digest) reportBrowserError(error)
  }, [error])

  return (
    <PageBody>
      <PageState kind="error" body={error.message || undefined} onRetry={reset} />
    </PageBody>
  )
}
