'use client'

import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import { loyaltyInsightsContent } from '@/data/loyalty-insights'
import { useCopy, useFormat } from '@/hooks/use-copy'
import {
  type CampaignStatus,
  type CampaignWindow,
  campaignStatus,
  nowOffset,
  timelineBars,
  timelineWeeks,
} from '@/lib/loyalty-campaigns'
import { routes } from '@/lib/routes'

type CampaignTimelineProps = {
  campaigns: (CampaignWindow & { name: string })[]
  now: Date
}

/** Bar colours by status: running stands out, scheduled is quieter, ended is grey. */
const BAR: Record<CampaignStatus, string> = {
  running: 'bg-primary text-primary-foreground',
  scheduled: 'bg-primary/15 text-foreground ring-1 ring-primary/40 ring-inset',
  ended: 'bg-muted text-muted-foreground',
}

/** Rem per lane: a 1.5rem bar and a 0.375rem gap. */
const LANE_REM = 1.875

/** Twelve weeks around today with each campaign as a bar; overlapping campaigns stack. */
export default function CampaignTimeline({ campaigns, now }: CampaignTimelineProps) {
  // Hooks
  const copy = useCopy(loyaltyInsightsContent)
  const f = useFormat()

  // Render logic
  const c = copy.campaigns
  const weeks = timelineWeeks(now)
  const bars = timelineBars(campaigns, weeks)
  const byId = new Map(campaigns.map((x) => [x.id, x]))
  const lanes = Math.max(1, ...bars.map((b) => b.lane + 1))
  const today = nowOffset(weeks, now)

  return (
    <DataCard title={c.timeline}>
      <div className="overflow-x-auto">
        <div className="min-w-[40rem]">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}>
            {weeks.map((w) => (
              <span
                key={w.toISOString()}
                className="border-l border-border pb-1 pl-1 text-micro text-muted-foreground"
                title={c.weekOf(f.date(w))}
              >
                {f.pattern(w, { day: 'numeric', month: 'short' })}
              </span>
            ))}
          </div>
          <div className="relative" style={{ height: `${lanes * LANE_REM + 0.5}rem` }}>
            <div
              className="absolute inset-0 grid"
              style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}
              aria-hidden="true"
            >
              {weeks.map((w) => (
                <span key={w.toISOString()} className="border-l border-border" />
              ))}
            </div>
            {today === null ? null : (
              <span
                className="absolute inset-y-0 w-px bg-danger"
                style={{ left: `${today * 100}%` }}
                title={c.today}
              />
            )}
            {bars.map((b) => {
              const camp = byId.get(b.id)
              if (!camp) return null
              return (
                <Link
                  key={b.id}
                  href={routes.apps.page('loyalty', 'campaigns', b.id)}
                  className={cn(
                    'absolute flex h-6 items-center truncate px-2 text-caption font-medium transition-opacity hover:opacity-80',
                    BAR[campaignStatus(camp, now)],
                    b.clippedStart ? 'rounded-l-none' : 'rounded-l-md',
                    b.clippedEnd ? 'rounded-r-none' : 'rounded-r-md',
                  )}
                  style={{
                    left: `${b.left * 100}%`,
                    width: `${b.width * 100}%`,
                    top: `${b.lane * LANE_REM + 0.25}rem`,
                  }}
                  title={camp.name}
                >
                  {camp.name}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </DataCard>
  )
}
