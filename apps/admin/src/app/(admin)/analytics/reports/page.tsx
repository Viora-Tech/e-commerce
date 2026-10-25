import type { Metadata } from 'next'
import ReportsHome from '@/components/analytics/reports-home'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Reports' }

export default async function Page() {
  const context = await serverContext()
  const [reports, saved, ai] = await Promise.all([
    call(appRouter.analytics.reports, undefined, { context }),
    call(appRouter.analytics.savedReports, undefined, { context }),
    call(appRouter.ai.status, undefined, { context }).catch(() => null),
  ])
  return <ReportsHome reports={reports} saved={saved} assistant={ai?.assistant ?? false} />
}
