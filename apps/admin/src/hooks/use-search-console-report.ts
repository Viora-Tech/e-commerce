'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'

export type SearchConsoleReport = Awaited<ReturnType<typeof api.searchConsole.report>>
export type SearchConsoleReady = Extract<SearchConsoleReport, { state: 'ready' }>

/**
 * The Google Search Console app's report for its pages: null while loading, `failed` when the
 * call itself failed, and `reload` after "Refresh now".
 */
export function useSearchConsoleReport() {
  const [report, setReport] = useState<SearchConsoleReport | null>(null)
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `revision` re-runs the load after Refresh now
  useEffect(() => {
    let cancelled = false
    api.searchConsole
      .report()
      .then((r) => {
        if (cancelled) return
        setReport(r)
        setFailed(false)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [revision])

  return { report, failed, reload: () => setRevision((n) => n + 1) }
}
