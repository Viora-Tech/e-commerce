'use client'

import type { ReportDefinition, ReportResult } from '@commerce/api'
import {
  type ParsedQuery,
  type ParseResult,
  parseQuery,
  type QueryError,
  STARTER_QUERY,
} from '@commerce/core/analytics-query'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api-client'

export type Ran = { report: ReportDefinition; result: ReportResult; ms: number }

/** How long the editor waits after a keystroke before it checks and runs the query. */
export const CHECK_DELAY_MS = 250

type Checked = { source: string; result: ParseResult }

/** Two queries that only differ in spacing, case or comments run once. */
export const queryKey = (result: ParseResult): string | null =>
  result.ok ? JSON.stringify(result.query) : null

/** The parsed query, or the starter's when the text does not parse. */
function parsedOr(result: ParseResult): ParsedQuery {
  if (result.ok) return result.query
  const starter = parseQuery(STARTER_QUERY)
  if (!starter.ok) throw new Error('The starter query does not parse')
  return starter.query
}

/**
 * Live validation and auto-run for the query editor: text is parsed shortly after typing
 * stops, and a valid query that differs from the last one run is sent to the server. Answers
 * to anything but the latest request are dropped, so a slow run never overwrites a newer one.
 */
export function useQueryRunner(initialSource: string, initial: Ran | null) {
  // Hooks
  const [checked, setChecked] = useState<Checked>(() => ({
    source: initialSource,
    result: parseQuery(initialSource),
  }))
  const [good, setGood] = useState<ParsedQuery>(() => parsedOr(parseQuery(initialSource)))
  const [ran, setRan] = useState<Ran | null>(initial)
  const [runError, setRunError] = useState<QueryError | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(0)
  const lastKey = useRef<string | null>(initial ? queryKey(checked.result) : null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  // Helpers
  const run = async (source: string, force = false) => {
    const key = queryKey(parseQuery(source))
    if (!key || (!force && key === lastKey.current)) return
    lastKey.current = key
    const id = ++latest.current
    setBusy(true)
    try {
      const out = await api.analytics.query({ source })
      if (id !== latest.current) return
      setFailed(false)
      if (out.ok) {
        setRan({ report: out.report, result: out.result, ms: out.ms })
        setRunError(null)
      } else {
        setRunError(out.error)
      }
    } catch {
      if (id !== latest.current) return
      lastKey.current = null
      setFailed(true)
    } finally {
      if (id === latest.current) setBusy(false)
    }
  }

  const checkNow = (source: string) => {
    if (timer.current) clearTimeout(timer.current)
    const result = parseQuery(source)
    setChecked({ source, result })
    if (!result.ok) return
    setGood(result.query)
    void run(source)
  }

  return {
    /** The last checked text's parse: what the controls and the status line show. */
    checked,
    /** The last query that parsed, so the controls keep showing it (greyed) while the text has a problem. */
    good,
    ran,
    busy,
    failed,
    /** The server's complaint about the last run (the same parser, so rare). */
    runError,
    /** After a keystroke: check and run once typing pauses. */
    schedule: (source: string) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => checkNow(source), CHECK_DELAY_MS)
    },
    /** After a control, Format, undo or an AI answer: check and run straight away. */
    checkNow,
    /** The Run button and ⌘↵: runs even when the query has not changed. */
    runNow: (source: string) => {
      if (timer.current) clearTimeout(timer.current)
      const result = parseQuery(source)
      setChecked({ source, result })
      if (!result.ok) return
      setGood(result.query)
      void run(source, true)
    },
  }
}
