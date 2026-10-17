'use client'

import type { SeoReport } from '@commerce/core'
import { cn } from '@commerce/ui/lib/utils'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import { seoReportContent } from '@/data/seo-report'
import { useCopy, useFormat } from '@/hooks/use-copy'

type SeoScoreCardProps = {
  report: SeoReport
}

/** Score bands: 80+ is good, 50–79 fair, below 50 needs work. */
function band(score: number): 'good' | 'fair' | 'poor' {
  if (score >= 80) return 'good'
  if (score >= 50) return 'fair'
  return 'poor'
}

const RING_TONE = { good: 'text-success', fair: 'text-warning', poor: 'text-danger' } as const
const RESOURCES = ['product', 'collection', 'page', 'menu'] as const
const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Figma SEO (687:5327): the score on a ring, what it means, issue counts by impact and by area. */
export default function SeoScoreCard({ report }: SeoScoreCardProps) {
  // Hooks
  const copy = useCopy(seoReportContent.score)
  const fmt = useFormat()

  // Helpers
  const count = (severity: 'high' | 'medium' | 'low') =>
    report.issues.filter((i) => i.severity === severity).length

  // Render logic
  const level = band(report.score)
  const filled = (Math.max(0, Math.min(100, report.score)) / 100) * CIRCUMFERENCE

  return (
    <SettingsCard title={copy.label}>
      <div className="flex flex-wrap items-center gap-6">
        <div className="relative size-32 shrink-0">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
            <circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              strokeWidth="10"
              className="stroke-muted"
            />
            <circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              stroke="currentColor"
              strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
              className={RING_TONE[level]}
            />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[2.25rem] leading-none font-semibold text-ink-strong tabular-nums">
              {report.score}
            </span>
            <span className="text-caption text-muted-foreground">{copy.outOf}</span>
          </span>
        </div>
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
