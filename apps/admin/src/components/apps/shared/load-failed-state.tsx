'use client'

import InlineState from '@/components/states/inline-state'
import PageState from '@/components/states/page-state'
import type { LoadFailure } from '@/hooks/use-load'

type LoadFailedStateProps = {
  /** What did not load, in words: "Could not load the queue" (`appsContent.couldNotLoad`). */
  heading: string
  /** The reason, when the read gave one in words; the generic line otherwise. */
  body?: string | undefined
  onRetry: () => void
  /** From `useLoad`: a FORBIDDEN read shows "You do not have access" without Try again. */
  failed?: LoadFailure | undefined
  /** `inline` (default) inside a card or section; `page` for a whole app page. */
  size?: 'inline' | 'page'
  className?: string
}

/**
 * An app page or card whose read failed: "Could not load the …" with Try again, the shared
 * InlineState / PageState (like LoadFailed, with the app's own words), so a failure never reads
 * as an empty list or a blank page.
 */
export default function LoadFailedState({
  heading,
  body,
  onRetry,
  failed = 'error',
  size = 'inline',
  className,
}: LoadFailedStateProps) {
  // Render logic
  const noAccess = failed === 'no-access'

  return size === 'page' ? (
    noAccess ? (
      <PageState kind="no-access" />
    ) : (
      <PageState kind="error" heading={heading} body={body} onRetry={onRetry} />
    )
  ) : noAccess ? (
    <InlineState kind="no-access" className={className} />
  ) : (
    <InlineState
      kind="error"
      heading={heading}
      body={body}
      onRetry={onRetry}
      className={className}
    />
  )
}
