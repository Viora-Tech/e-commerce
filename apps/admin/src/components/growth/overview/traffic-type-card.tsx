'use client'

import { TRAFFIC_TYPES, type TrafficType } from '@commerce/core/marketing'
import { Card } from '@commerce/ui/shadcn/card'
import { growthHomeContent } from '@/data/growth-home'
import { useCopy, useFormat } from '@/hooks/use-copy'
import MetricLabel from '../metric-label'

type TrafficTypeCardProps = { counts: Record<TrafficType, number> }

const COLOURS: Record<TrafficType, string> = {
  direct: 'bg-chart-1',
  paid: 'bg-chart-2',
  organic: 'bg-chart-3',
  unknown: 'bg-chart-4',
}

/** "Sessions by traffic type": direct, paid, organic and unknown counts over one stacked bar. */
export default function TrafficTypeCard({ counts }: TrafficTypeCardProps) {
  // Hooks
  const copy = useCopy(growthHomeContent.traffic)
  const fmt = useFormat()

  // Render logic
  const total = TRAFFIC_TYPES.reduce((n, t) => n + counts[t], 0)

  return (
    <Card inset={5} gap={4} className="min-w-0">
      <MetricLabel help={copy.help} className="text-body-strong text-foreground">
        {copy.label}
      </MetricLabel>
      <dl className="flex flex-wrap gap-x-8 gap-y-2">
        {TRAFFIC_TYPES.map((t) => (
          <div key={t} className="flex flex-col gap-0.5">
            <dt className="flex items-center gap-1.5 text-caption text-muted-foreground">
              <span aria-hidden className={`size-2 rounded-full ${COLOURS[t]}`} />
              {copy.types[t]}
            </dt>
            <dd className="pl-3.5 text-body-strong tabular-nums text-foreground">
              {fmt.number(counts[t])}
            </dd>
          </div>
        ))}
      </dl>
      {total === 0 ? (
        /* No sessions yet: the empty track keeps the card's shape, with a note on it. */
        <div className="flex h-14 w-full items-center justify-center rounded-md bg-muted">
          <span className="text-caption text-muted-foreground">{copy.empty}</span>
        </div>
      ) : (
        <div className="flex h-14 w-full gap-0.5 overflow-hidden rounded-md" aria-hidden>
          {TRAFFIC_TYPES.filter((t) => counts[t] > 0).map((t) => (
            <span
              key={t}
              className={`h-full min-w-1 ${COLOURS[t]}`}
              style={{ width: `${(counts[t] / total) * 100}%` }}
            />
          ))}
        </div>
      )}
    </Card>
  )
}
