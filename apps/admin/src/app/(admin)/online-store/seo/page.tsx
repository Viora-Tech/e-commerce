import { SearchIcon } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import SeoReportPage from '@/components/seo/seo-report-page'
import { seoReportContent } from '@/data/seo-report'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'

export const metadata: Metadata = { title: 'SEO' }

export default async function Page() {
  const context = await serverContext()
  const [report, ai, copy] = await Promise.all([
    call(appRouter.seo.report, undefined, { context }).catch(() => null),
    call(appRouter.ai.status, undefined, { context }).catch(() => null),
    getCopy(seoReportContent),
  ])

  if (!report) return <SectionEmpty {...copy.unavailable} icon={SearchIcon} />
  return <SeoReportPage report={report} aiBulk={ai?.bulkWriter ?? false} />
}
