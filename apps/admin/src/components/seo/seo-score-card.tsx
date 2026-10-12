'use client'

import type { SeoReport } from '@commerce/core'
import { cn } from '@commerce/ui/lib/utils'
import SettingsCard from '@/components/settings/settings-card'
import { seoReportContent } from '@/data/seo-report'
import { useCopy } from '@/hooks/use-copy'

type SeoScoreCardProps = {
  report: SeoReport
}

/** Score bands: 80+ is good, 50–79 fair, below 50 needs work. */
function band(score: number): 'good' | 'fair' | 'poor' {
  if (score >= 80) return 'good'
  if (score >= 50) return 'fair'
  return 'poor'
}

const BAND_TONE = {
  good: 'text-success',
  fair: 'text-warning',
  poor: 'text-danger',
} as const

/** The SEO score (0–100), what it means in words, and how many items and issues it covers. */
export default function SeoScoreCard({ report }: SeoScoreCardProps) {
  // Hooks
  const copy = useCopy(seoReportContent.score)

  // Helpers
  const count = (severity: 'high' | 'medium' | 'low') =>
    report.issues.filter((i) => i.severity === severity).length

  // Render logic
  const level = band(report.score)

  return (
    <SettingsCard title={copy.label}>
      <div className="flex items-end gap-3">
        <span className={cn('text-[2.75rem] leading-none font-semibold', BAND_TONE[level])}>
          {report.score}
        </span>
        <span className="pb-1 text-body text-muted-foreground">{copy.outOf}</span>
      </div>
      <p className={cn('text-body font-medium', BAND_TONE[level])}>{copy[level]}</p>
      <p className="text-body text-muted-foreground">
        {copy.checked(report.checked.product, report.checked.collection, report.checked.page)}
      </p>
      <p className="text-caption text-muted-foreground">
        {copy.counts(count('high'), count('medium'), count('low'))}
      </p>
    </SettingsCard>
  )
}
