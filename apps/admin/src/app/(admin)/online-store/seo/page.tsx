import type { Metadata } from 'next'
import SeoReportPage from '@/components/seo/seo-report-page'
import ServerLoadFailed from '@/components/states/server-load-failed'
import { seoReportContent } from '@/data/seo-report'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'
import { didFail, loadFailure } from '@/lib/load-failure'

export const metadata: Metadata = { title: 'SEO' }

export default async function Page() {
  const context = await serverContext()
  const [report, ai, copy] = await Promise.all([
    call(appRouter.seo.report, undefined, { context }).catch(loadFailure),
    call(appRouter.ai.status, undefined, { context }).catch(() => null),
    getCopy(seoReportContent),
  ])

  if (didFail(report)) return <ServerLoadFailed failed={report.failed} heading={copy.loadFailed} />
  return <SeoReportPage report={report} aiBulk={ai?.bulkWriter ?? false} />
}
