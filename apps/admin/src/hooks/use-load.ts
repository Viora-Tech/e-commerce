'use client'

import { type DependencyList, type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import { isForbidden } from '@/lib/forbidden'

/** Why a load gave up: a plain failure (offer Try again) or the member's role (no-access). */
export type LoadFailure = 'error' | 'no-access'

export type Loaded<T> = {
  /** The answer; `null` until it arrives (and after a failure). */
  data: T | null
  /** `false` while loading or loaded; why it failed otherwise. */
  failed: LoadFailure | false
  /** True until the first answer or failure, and again while a retry runs. */
  loading: boolean
  /** Ask again (the Try again button). */
  retry: () => void
  /** Replace the data after a save, without asking the server again. */
  setData: Dispatch<SetStateAction<T | null>>
}

/**
 * One client read with its three states, so no page sits on a skeleton forever when the read
 * fails: `data` once it answers, `failed` (`'error'` or, for the API's FORBIDDEN, `'no-access'`)
 * when it does not, and `retry`. A page shows `<LoadFailed failed={failed} onRetry={retry} />`
 * for a failure. `deps` re-run the read, like an effect's. A read that answers after the page
 * moved on (unmount, new deps) is dropped.
 */
export function useLoad<T>(load: () => Promise<T>, deps: DependencyList = []): Loaded<T> {
  const [data, setData] = useState<T | null>(null)
  const [failed, setFailed] = useState<LoadFailure | false>(false)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: the caller's deps re-run the read
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    load()
      .then((value) => {
        if (cancelled) return
        setData(value)
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setFailed(isForbidden(error) ? 'no-access' : 'error')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [attempt, ...deps])

  return { data, failed, loading, retry: () => setAttempt((n) => n + 1), setData }
}
