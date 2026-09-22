import type { Metadata } from 'next'
import ReportsList from '@/components/analytics/reports-list'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Reports' }

export default async function Page() {
  const context = await serverContext()
  const reports = await call(appRouter.analytics.reports, undefined, { context })
  return <ReportsList reports={reports} />
}
