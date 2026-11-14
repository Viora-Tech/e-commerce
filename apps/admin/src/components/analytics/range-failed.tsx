'use client'

import PageState from '@/components/states/page-state'
import type { LoadFailure } from '@/hooks/use-load'

type RangeFailedProps = {
  /** Why the read for the new dates failed. */
  failed: LoadFailure
  /** "Could not load analytics for these dates". */
  heading: string
  onRetry: () => void
}

/**
 * What an analytics page shows in place of its figures when the read for a new date range
 * fails: "Could not load … for these dates" with Try again, or "You do not have access" for a
 * role that may not read it. The old range's numbers are not left standing under the new range.
 */
export default function RangeFailed({ failed, heading, onRetry }: RangeFailedProps) {
  // Render logic
  return failed === 'no-access' ? (
    <PageState kind="no-access" />
  ) : (
    <PageState kind="error" heading={heading} onRetry={onRetry} />
  )
}
