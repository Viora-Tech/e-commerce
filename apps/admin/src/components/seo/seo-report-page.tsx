'use client'

import type { SeoReport } from '@commerce/core'
import { useRouter } from 'next/navigation'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { seoReportContent } from '@/data/seo-report'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import SeoFixCard, { type SeoFixField } from './seo-fix-card'
import SeoIssuesCard from './seo-issues-card'
import SeoScoreCard from './seo-score-card'

type SeoReportPageProps = {
  report: SeoReport
  aiBulk: boolean
}

/** Most products one Write with AI run takes (the API's BULK_MAX). */
const AI_RUN_MAX = 200

/** Online store → SEO: the score, "Fix with AI" for what AI can write, and the issue list. */
export default function SeoReportPage({ report, aiBulk }: SeoReportPageProps) {
  // Hooks
  const router = useRouter()
  const copy = useCopy(seoReportContent)

  // Event handlers
  const handleFix = (field: SeoFixField) => {
    const ids = report.fixable[field].slice(0, AI_RUN_MAX)
    router.push(routes.products.bulkWrite({ ids, fields: [field], from: 'seo' }))
  }

  return (
    <PageBody className="gap-6 md:pt-5 md:pb-8">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      <div className="grid gap-4 md:grid-cols-2">
        <SeoScoreCard report={report} />
        <SeoFixCard fixable={report.fixable} aiOn={aiBulk} max={AI_RUN_MAX} onFix={handleFix} />
      </div>
      <SeoIssuesCard issues={report.issues} />
    </PageBody>
  )
}
