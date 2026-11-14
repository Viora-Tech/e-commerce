'use client'

import type { MarketingOverview } from '@commerce/api'
import { useEffect, useState } from 'react'
import type { LoadFailure } from '@/hooks/use-load'
import { type RangeState, sameRange } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import { isForbidden } from '@/lib/forbidden'

/**
 * The marketing overview for the picked range (Growth overview and Attribution): the server's
 * answer for the first range, a client read for any other. A failed read says so (`failed`, with
 * `retry`) instead of leaving the old range's numbers under the new dates.
 */
export function useOverviewRange(
  range: RangeState,
  initialRange: RangeState,
  initial: MarketingOverview,
) {
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState<LoadFailure | false>(false)
  const [attempt, setAttempt] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the read (Try again)
  useEffect(() => {
    setFailed(false)
    if (sameRange(range, initialRange)) {
      setData(initial)
      setLoading(false)
      return
    }
    let live = true
    setLoading(true)
    api.marketing
      .overview({ range })
      .then((next) => {
        if (live) setData(next)
      })
      .catch((error: unknown) => {
        if (live) setFailed(isForbidden(error) ? 'no-access' : 'error')
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [range, initialRange, initial, attempt])

  return { data, loading, failed, retry: () => setAttempt((n) => n + 1) }
}
