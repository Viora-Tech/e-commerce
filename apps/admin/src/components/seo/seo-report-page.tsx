'use client'

import type { SeoReport } from '@commerce/core'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import BulkWriteSheet from '@/components/products/bulk-write/bulk-write-sheet'
import { seoReportContent } from '@/data/seo-report'
import { useCopy } from '@/hooks/use-copy'
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
  const [writing, setWriting] = useState<SeoFixField | null>(null)

  // Event handlers
  const handleOpenChange = (open: boolean) => {
    if (open) return
    setWriting(null)
    router.refresh()
  }

  // Render logic
  const productIds = writing ? report.fixable[writing].slice(0, AI_RUN_MAX) : null

  return (
    <PageBody className="gap-6 md:pt-5 md:pb-8">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      <div className="grid gap-4 md:grid-cols-2">
        <SeoScoreCard report={report} />
        <SeoFixCard
          fixable={report.fixable}
          aiOn={aiBulk}
          max={AI_RUN_MAX}
          onFix={(field) => setWriting(field)}
        />
      </div>
      <SeoIssuesCard issues={report.issues} />
      {aiBulk && writing ? (
        <BulkWriteSheet
          key={writing}
          open
          onOpenChange={handleOpenChange}
          productIds={productIds}
          jobId={null}
          initialFields={[writing]}
          onApplied={() => router.refresh()}
        />
      ) : null}
    </PageBody>
  )
}
