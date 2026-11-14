'use client'

import InlineState from '@/components/states/inline-state'
import PageState from '@/components/states/page-state'
import type { LoadFailure } from '@/hooks/use-load'

type LoadFailedProps = {
  /** From `useLoad`: why the read failed. */
  failed: LoadFailure
  onRetry: () => void
  /** `inline` for one card or section; `page` (default) for a whole page. */
  size?: 'page' | 'inline'
  className?: string
}

/**
 * What a page or card shows when its read fails (`useLoad`): "Something went wrong" with Try
 * again, or, when the member's role does not allow the read, "You do not have access" (no retry,
 * since asking again gives the same answer).
 */
export default function LoadFailed({ failed, onRetry, size = 'page', className }: LoadFailedProps) {
  // Render logic
  const noAccess = failed === 'no-access'

  return size === 'inline' ? (
    noAccess ? (
      <InlineState kind="no-access" className={className} />
    ) : (
      <InlineState kind="error" onRetry={onRetry} className={className} />
    )
  ) : noAccess ? (
    <PageState kind="no-access" />
  ) : (
    <PageState kind="error" onRetry={onRetry} />
  )
}
