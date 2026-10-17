import { STARTER_QUERY } from '@commerce/core/analytics-query'
import type { Metadata } from 'next'
import QueryReportView from '@/components/analytics/query/query-report-view'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Custom query' }

export default async function Page() {
  const context = await serverContext()
  const out = await call(appRouter.analytics.query, { source: STARTER_QUERY }, { context })
  return (
    <QueryReportView
      initialSource={STARTER_QUERY}
      initial={out.ok ? { report: out.report, result: out.result, ms: out.ms } : null}
    />
  )
}
