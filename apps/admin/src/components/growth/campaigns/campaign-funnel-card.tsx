'use client'

import type { CampaignReport } from '@commerce/api'
import type { CSSProperties } from 'react'
import DataCard from '@/components/layout/data-card'
import { campaignPerformanceContent } from '@/data/growth-report'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { formatRate } from '@/lib/analytics-range'

type CampaignFunnelCardProps = { report: CampaignReport }

const barWidth = (share: number) => `${Math.max(1, Math.min(100, Math.round(share * 100)))}%`

/**
 * Sent → delivered → opened → visited → added to cart → ordered, each step with its share of
 * the one before. Steps the channel cannot measure are left out and the card says why.
 */
export default function CampaignFunnelCard({ report }: CampaignFunnelCardProps) {
  // Hooks
  const copy = useCopy(campaignPerformanceContent.funnel)
  const fmt = useFormat()

  // Render logic
  const notes = report.omitted.map((id) => copy.omitted[id]).filter(Boolean)

  return (
    <DataCard title={copy.title} subtitle={copy.subtitle}>
      <ol className="flex flex-col gap-3">
        {report.funnel.map((step, i) => (
          <li key={step.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-body-strong text-foreground">{copy.steps[step.id]}</span>
              <span className="flex items-baseline gap-2">
                <span className="text-body-strong text-ink-strong tabular-nums">
                  {fmt.number(step.value)}
                </span>
                {i > 0 ? (
                  <span className="text-caption text-muted-foreground tabular-nums">
                    {copy.ofPrevious(formatRate(step.ofPrevious))}
                  </span>
                ) : null}
              </span>
            </div>
            <div aria-hidden className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full w-(--w) rounded-full bg-primary"
                style={{ '--w': barWidth(step.ofFirst) } as CSSProperties}
              />
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-col gap-1 text-caption text-muted-foreground">
        {notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
        <p>{copy.help}</p>
      </div>
    </DataCard>
  )
}
