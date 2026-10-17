'use client'

import type { SeoReport } from '@commerce/core'
import { cn } from '@commerce/ui/lib/utils'
import ScoreRing from '@/components/layout/score-ring'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import { seoReportContent } from '@/data/seo-report'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { scoreBand } from '@/lib/score'

type SeoScoreCardProps = {
  report: SeoReport
}

const RESOURCES = ['product', 'collection', 'page', 'menu'] as const

/** Figma SEO (687:5327): the score on a ring, what it means, issue counts by impact and by area. */
export default function SeoScoreCard({ report }: SeoScoreCardProps) {
  // Hooks
  const copy = useCopy(seoReportContent.score)
  const fmt = useFormat()

  // Helpers
  const count = (severity: 'high' | 'medium' | 'low') =>
    report.issues.filter((i) => i.severity === severity).length

  // Render logic
  const level = scoreBand(report.score)

  return (
    <SettingsCard title={copy.label}>
      <div className="flex flex-wrap items-center gap-6">
        <ScoreRing score={report.score} caption={copy.outOf} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-card-title text-ink-strong">{copy[level]}</p>
          <p className="text-body text-muted-foreground">
            {copy.checked(report.checked.product, report.checked.collection, report.checked.page)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <StatusChip tone="danger">{copy.high(count('high'))}</StatusChip>
            <StatusChip tone="attention">{copy.medium(count('medium'))}</StatusChip>
            <StatusChip>{copy.low(count('low'))}</StatusChip>
          </div>
        </div>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
        {RESOURCES.map((r) => {
          const n = report.issues.filter((i) => i.resource === r).length
          return (
            <div key={r} className="flex flex-col gap-1">
              <dt className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
                {copy.resources[r]}
              </dt>
              <dd className={cn('text-body', n > 0 ? 'text-ink-strong' : 'text-muted-foreground')}>
                <span className="font-medium tabular-nums">{fmt.number(n)}</span>{' '}
                <span className="text-caption text-muted-foreground">{copy.issues(n)}</span>
              </dd>
            </div>
          )
        })}
      </dl>
    </SettingsCard>
  )
}
