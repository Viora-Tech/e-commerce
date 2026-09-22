import { findReport } from '@commerce/api'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ReportView from '@/components/analytics/report-view'
import { parseRange } from '@/lib/analytics-range'
import { appRouter, call, serverContext } from '@/lib/api'
import type { SearchParams } from '@/lib/list-query'

export const metadata: Metadata = { title: 'Report' }

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params
  const report = findReport(slug)
  if (!report?.available) notFound()
  const range = parseRange(await searchParams)
  const context = await serverContext()
  const result = await call(appRouter.analytics.report, { slug, range }, { context })
  return <ReportView report={report} initialRange={range} initial={result} />
}
