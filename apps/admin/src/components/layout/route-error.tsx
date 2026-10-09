'use client'

import { useEffect } from 'react'
import PageBody from '@/components/layout/page-body'
import PageState from '@/components/states/page-state'

type RouteErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

/** Shared body for every `error.tsx`: what went wrong, one retry. */
export default function RouteError({ error, reset }: RouteErrorProps) {
  // Hooks
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <PageBody>
      <PageState kind="error" body={error.message || undefined} onRetry={reset} />
    </PageBody>
  )
}
