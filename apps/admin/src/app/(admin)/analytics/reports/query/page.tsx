import { STARTER_QUERY } from '@commerce/core/analytics-query'
import type { Metadata } from 'next'
import QueryReportView, { type SavedQuery } from '@/components/analytics/query/query-report-view'
import { appRouter, call, serverContext } from '@/lib/api'
import type { SearchParams } from '@/lib/list-query'

export const metadata: Metadata = { title: 'Custom query' }

type Props = { searchParams: Promise<SearchParams> }

const QUERY_PARAM_MAX = 4000

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function Page({ searchParams }: Props) {
  const { saved: savedParam, q } = await searchParams
  const savedId = typeof savedParam === 'string' && UUID.test(savedParam) ? savedParam : null
  const context = await serverContext()
  const [row, ai] = await Promise.all([
    savedId
      ? call(appRouter.analytics.getSavedReport, { id: savedId }, { context }).catch(() => null)
      : null,
    call(appRouter.ai.status, undefined, { context }).catch(() => null),
  ])
  const saved: SavedQuery | null =
    row?.reportSlug === 'query' && row.query
      ? { id: row.id, name: row.name, source: row.query }
      : null
  /* `?q=`: an AI answer opened as a report (#102); the server parses and checks it like any query. */
  const asked = typeof q === 'string' && q.trim() && q.length <= QUERY_PARAM_MAX ? q : null
  const source = saved?.source ?? asked ?? STARTER_QUERY
  const out = await call(appRouter.analytics.query, { source }, { context })
  return (
    <QueryReportView
      key={saved?.id ?? asked ?? 'new'}
      initialSource={source}
      initial={out.ok ? { report: out.report, result: out.result, ms: out.ms } : null}
      saved={saved}
      ai={!ai?.configured ? 'hidden' : ai.assistant ? 'on' : 'off'}
    />
  )
}
